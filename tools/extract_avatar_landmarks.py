"""Avatar video-retarget pilot — extract world-landmark clips for the 5 pilot signs from ASL
Citizen (-> data/avatar_landmarks/, NEVER data/landmarks/ which is recognition training data).

See docs/VIDEO_RETARGET_HANDOFF.md for the full plan. This is Phase 2. Differs from
tools/extract_dataset.py in three ways:
  1. Requests MediaPipe WORLD landmarks (metric 3D, elbow included) via Capture(want_world_landmarks=True)
     with pose_landmarker_full.task (more accurate than the live game's _lite model — offline
     extraction doesn't need real-time speed).
  2. Restricted to the 5 pilot glosses (PILOT_GLOSSES below), not the full 18-sign GAME_VOCAB.
  3. No 1-euro smoothing at extraction (Phase 4 smooths body-frame-normalized trajectories in TS,
     not raw pixel/world coordinates here) — stays raw/honest, same philosophy as extract_dataset.py.

After extraction, ranks clips per sign by tracking quality (Amendment A2: elbow coverage, hand
coverage, snap count, both-hands coverage for two-handed signs) and writes a manifest so Phase 3
knows which clip(s) to retarget from.

Usage (from repo root, with venv active):
    python -m tools.extract_avatar_landmarks --zip E:/ASL_Citizen.zip --out data/avatar_landmarks
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise ImportError("extract_avatar_landmarks needs opencv-python (pip install -r requirements.txt)") from exc

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.capture import Capture, DEFAULT_HAND_MODEL  # noqa: E402
from core.landmarks import Frame  # noqa: E402

DEFAULT_POSE_MODEL_FULL = os.path.join("models", "pose_landmarker_full.task")

# ASL Citizen gloss -> our engine sign name, restricted to the 5 pilot signs (subset of
# tools/asl_citizen_vocab.py's GAME_VOCAB — same gloss folding rules: sense-number variants of
# the same word fold into one sign).
PILOT_VOCAB: dict[str, str] = {
    "HELLO": "HELLO",
    "YOU": "YOU",
    "COFFEE": "COFFEE",
    "WANT1": "WANT",
    "WANT2": "WANT",
    "HOSPITAL1": "HOSPITAL",
    "HOSPITAL2": "HOSPITAL",
}
TWO_HANDED_SIGNS = {"COFFEE", "WANT"}  # HOSPITAL/YOU/HELLO are one-handed in this vocabulary

WRIST_SNAP_FRACTION_OF_WIDTH = 0.25  # mirrors web/src/avatar/retarget/LandmarkLoader.ts SNAP_FRACTION_OF_WIDTH


# ----------------------------------------------------------------------------- extraction

def extract_video_avatar(path: str, capture: Capture, sign_name: str) -> dict:
    """Run MediaPipe (with world landmarks) over one video. Raw, unsmoothed — see module docstring."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise IOError(f"could not open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if fps <= 1e-3:
        fps = 30.0

    frames: list[Frame] = []
    idx = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        t = idx / fps
        frames.append(capture.process(bgr, timestamp_ms=int(t * 1000), t_seconds=t))
        idx += 1
    cap.release()

    return {"sign_name": sign_name, "frames": [f.to_dict() for f in frames]}


# ----------------------------------------------------------------------------- quality report

def clip_quality(payload: dict, sign_name: str) -> dict:
    """Per-clip tracking-quality numbers for Amendment A2's best-clip ranking.

    Mirrors the checks web/src/avatar/retarget/LandmarkLoader.ts's validateClip runs on the OLD
    dataset, extended with elbow/world-landmark coverage since that's the whole point of this
    pipeline. A clip that scores well here is trustworthy input for VideoArmRetargeter (Phase 3);
    a clip that scores badly should not be silently used (guardrail: fail loudly on incomplete data).
    """
    frames = payload["frames"]
    n = len(frames)
    if n == 0:
        return {"n_frames": 0, "quality_score": 0.0, "reject_reason": "zero frames"}

    both_hands_needed = sign_name in TWO_HANDED_SIGNS
    with_any_hand = 0
    with_both_hands = 0
    with_pose_world = 0
    with_both_elbows = 0
    with_hand_world = 0
    snap_count = 0
    last_wrist_by_side: dict[str, tuple[float, float]] = {}

    for fr in frames:
        hands = fr["hands"]
        if hands:
            with_any_hand += 1
        if len(hands) >= 2:
            with_both_hands += 1
        pw = fr.get("pose_world")
        if pw is not None:
            with_pose_world += 1
            if "left_elbow" in pw and "right_elbow" in pw:
                with_both_elbows += 1
        if any(h.get("world_points") is not None for h in hands):
            with_hand_world += 1

        width = fr["width"]
        for h in hands:
            side = h["handedness"]
            wrist = h["points"][0]  # [x_px, y_px, z]
            wx, wy = wrist[0], wrist[1]
            prev = last_wrist_by_side.get(side)
            if prev is not None:
                jump = float(np.hypot(wx - prev[0], wy - prev[1]))
                if jump > width * WRIST_SNAP_FRACTION_OF_WIDTH:
                    snap_count += 1
            last_wrist_by_side[side] = (wx, wy)

    hand_coverage = with_any_hand / n
    both_hand_coverage = with_both_hands / n
    elbow_coverage = with_both_elbows / n
    hand_world_coverage = with_hand_world / n

    # Weighted score: elbow coverage matters most (it's the entire point of this pipeline),
    # then hand coverage (both hands if the sign needs them), penalized by tracking snaps.
    score = 0.45 * elbow_coverage + 0.35 * (both_hand_coverage if both_hands_needed else hand_coverage)
    score += 0.20 * hand_world_coverage
    score -= 0.05 * min(snap_count, 10)

    reject_reason = None
    if elbow_coverage < 0.5:
        reject_reason = f"elbow coverage too low ({elbow_coverage:.2f})"
    elif both_hands_needed and both_hand_coverage < 0.3:
        reject_reason = f"two-handed sign but both-hand coverage too low ({both_hand_coverage:.2f})"
    elif not both_hands_needed and hand_coverage < 0.5:
        reject_reason = f"hand coverage too low ({hand_coverage:.2f})"

    return {
        "n_frames": n,
        "hand_coverage": round(hand_coverage, 3),
        "both_hand_coverage": round(both_hand_coverage, 3),
        "elbow_coverage": round(elbow_coverage, 3),
        "hand_world_coverage": round(hand_world_coverage, 3),
        "pose_world_coverage": round(with_pose_world / n, 3),
        "snap_count": snap_count,
        "quality_score": round(score, 4),
        "reject_reason": reject_reason,
    }


# ----------------------------------------------------------------------------- main pipeline

def run(args) -> None:
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows: list[tuple[str, str, str, str]] = []  # (split, video_file, gloss, participant)
    zf = zipfile.ZipFile(args.zip)
    for sp in ("train", "val", "test"):
        with zf.open(f"ASL_Citizen/splits/{sp}.csv") as f:
            for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                if r["Gloss"] in PILOT_VOCAB:
                    rows.append((sp, r["Video file"], r["Gloss"], r["Participant ID"]))

    by_sign: dict[str, list[tuple[str, str, str, str]]] = {}
    for row in rows:
        sign = PILOT_VOCAB[row[2]]
        by_sign.setdefault(sign, []).append(row)
    for sign, items in by_sign.items():
        print(f"[extract] {sign}: {len(items)} clips available across {len(PILOT_VOCAB)} pilot glosses")

    if args.max_per_sign:
        limited = []
        counts: dict[str, int] = {}
        for row in rows:
            sign = PILOT_VOCAB[row[2]]
            counts[sign] = counts.get(sign, 0) + 1
            if counts[sign] <= args.max_per_sign:
                limited.append(row)
        rows = limited
        print(f"[extract] capped to {args.max_per_sign} clips/sign -> {len(rows)} total")

    quality_rows: list[dict] = []
    members = set(zf.namelist())

    with Capture(
        hand_model=DEFAULT_HAND_MODEL,
        pose_model=DEFAULT_POSE_MODEL_FULL,
        want_world_landmarks=True,
    ) as capture:
        for i, (sp, vfile, gloss, signer) in enumerate(rows):
            sign = PILOT_VOCAB[gloss]
            stem = Path(vfile).stem
            sign_dir = out_dir / sign
            sign_dir.mkdir(parents=True, exist_ok=True)
            out_path = sign_dir / f"{stem}.json"

            if out_path.exists() and not args.force:
                payload = json.loads(out_path.read_text(encoding="utf-8"))
                q = clip_quality(payload, sign)
                quality_rows.append({"sign": sign, "gloss": gloss, "clip_id": f"{sign}/{stem}", "signer": signer, "split": sp, **q})
                continue

            member = f"ASL_Citizen/videos/{vfile}"
            if member not in members:
                print(f"  ! not in zip: {vfile}")
                continue

            tmp_path = None
            try:
                with zf.open(member) as src, tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                    tmp.write(src.read())
                    tmp_path = tmp.name
                payload = extract_video_avatar(tmp_path, capture, sign)
            except (IOError, OSError) as e:
                print(f"  ! failed {sign}/{stem}: {e}")
                continue
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            out_path.write_text(json.dumps(payload), encoding="utf-8")
            q = clip_quality(payload, sign)
            quality_rows.append({"sign": sign, "gloss": gloss, "clip_id": f"{sign}/{stem}", "signer": signer, "split": sp, **q})
            status = "OK" if not q["reject_reason"] else f"REJECT ({q['reject_reason']})"
            print(f"  [{i+1}/{len(rows)}] {sign}/{stem}  frames={q['n_frames']} "
                  f"elbow={q['elbow_coverage']} hand={q['hand_coverage']} score={q['quality_score']}  {status}")

    # Rank clips per sign, write the selection manifest Phase 3 reads.
    quality_rows.sort(key=lambda r: (r["sign"], -r["quality_score"]))
    manifest_path = out_dir / "quality_manifest.csv"
    if quality_rows:
        cols = list(quality_rows[0].keys())
        with open(manifest_path, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(quality_rows)
    print(f"\n[extract] quality manifest -> {manifest_path}")

    selection: dict[str, list[str]] = {}
    print("\n[extract] best clip(s) per pilot sign:")
    for sign in sorted(set(r["sign"] for r in quality_rows)):
        candidates = [r for r in quality_rows if r["sign"] == sign and not r["reject_reason"]]
        candidates.sort(key=lambda r: -r["quality_score"])
        best = candidates[: args.keep_per_sign]
        selection[sign] = [r["clip_id"].split("/", 1)[1] for r in best]
        if best:
            for r in best:
                print(f"  {sign}: {r['clip_id']}  score={r['quality_score']}  "
                      f"elbow={r['elbow_coverage']} hand={r['hand_coverage']} snaps={r['snap_count']}")
        else:
            print(f"  {sign}: NO CLIP PASSED QUALITY THRESHOLD — needs WLASL fallback or user-recorded footage")

    selection_path = out_dir / "selection.json"
    selection_path.write_text(json.dumps(selection, indent=2), encoding="utf-8")
    print(f"\n[extract] selection -> {selection_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract world-landmark clips for the 5 avatar pilot signs from ASL Citizen.")
    ap.add_argument("--zip", required=True, help="path to ASL_Citizen.zip")
    ap.add_argument("--out", default="data/avatar_landmarks")
    ap.add_argument("--max-per-sign", type=int, default=0, help="cap clips extracted per sign (0 = no cap)")
    ap.add_argument("--keep-per-sign", type=int, default=3, help="how many best clips to select per sign (Amendment A2)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    run(args)


if __name__ == "__main__":
    main()
