"""Download + extract MS-ASL game-vocab clips (-> Frame JSON, same pipeline as tools/wlasl_extract.py).

MS-ASL ships metadata only (YouTube URL + start_time/end_time in SECONDS per instance, unlike
WLASL's frame numbers). Several instances often share the same source video (it's a compilation
of many signs), so clips are GROUPED BY URL here — each video is downloaded once, then every
instance sliced from that single local copy, before the video is deleted. This matters: MS-ASL's
game-vocab subset needs ~1,089 clips from only ~488 unique videos, so per-instance downloading
(wlasl_extract.py's approach, fine there since WLASL instances rarely share a video) would nearly
double the bandwidth and YouTube request volume for no benefit.

Expect partial yield — MS-ASL is from 2019 and many source URLs are dead or region-locked. Skip
failures and log coverage, same convention as WLASL.

    python -m tools.msasl_extract --zip data/ms_asl/MS-ASL.zip --out data/ms_asl/landmarks

Resumable: an instance whose output JSON already exists is skipped without re-downloading its video.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise ImportError("msasl_extract needs opencv-python (pip install -r requirements.txt)") from exc

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.capture import Capture                                       # noqa: E402
from tools.extract_dataset import _smooth_hands_inplace, clip_stats, ManifestWriter  # noqa: E402
from tools.wlasl_extract import download                               # noqa: E402
from tools.msasl_vocab import MSASL_VOCAB                               # noqa: E402


def extract_time_range(path: str, capture: Capture, sign: str,
                        start_time: float, end_time: float) -> dict | None:
    """Run MediaPipe over [start_time, end_time] seconds of a video already on disk."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return None
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if fps <= 1e-3:
        fps = 30.0
    start_frame = max(0, int(start_time * fps))
    end_frame = int(end_time * fps) if end_time and end_time > 0 else 10 ** 9

    frames = []
    idx = 0
    while True:
        ok, bgr = cap.read()
        if not ok or idx >= end_frame:
            break
        if idx >= start_frame:
            t = (idx - start_frame) / fps
            frames.append(capture.process(bgr, int(t * 1000), t))
        idx += 1
    cap.release()
    if not frames:
        return None
    _smooth_hands_inplace(frames)
    return {"sign_name": sign, "frames": [f.to_dict() for f in frames]}


def _load_entries(zip_path: str) -> list[dict]:
    entries = []
    with zipfile.ZipFile(zip_path) as z:
        for split in ("train", "val", "test"):
            with z.open(f"MS-ASL/MSASL_{split}.json") as f:
                for e in json.load(f):
                    e["_split"] = split
                    entries.append(e)
    return entries


def main() -> None:
    ap = argparse.ArgumentParser(description="Download + extract MS-ASL game-vocab clips.")
    ap.add_argument("--zip", default="data/ms_asl/MS-ASL.zip")
    ap.add_argument("--out", default="data/ms_asl/landmarks")
    ap.add_argument("--tmp", default=None,
                    help="scratch dir for transient downloads (default: <out>/../_dl_tmp)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    tmp_dir = Path(args.tmp) if args.tmp else (Path(args.out).parent / "_dl_tmp")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    entries = _load_entries(args.zip)
    matching = [e for e in entries if e["clean_text"].strip().lower() in MSASL_VOCAB]
    by_url: dict[str, list[dict]] = defaultdict(list)
    for e in matching:
        by_url[e["url"]].append(e)
    print(f"[msasl] {len(matching)} instances across {len(by_url)} unique videos, "
          f"{len(set(MSASL_VOCAB[e['clean_text'].strip().lower()] for e in matching))} signs")

    writer = ManifestWriter(args.out)
    ok = fail = skip = 0
    with Capture() as capture:
        for url, group in by_url.items():
            vid_id = url.rstrip("/").split("=")[-1].split("/")[-1]

            # Skip the whole group (no download) if every instance already has output.
            pending = []
            for i, e in enumerate(group):
                sign = MSASL_VOCAB[e["clean_text"].strip().lower()]
                out_dir = Path(args.out) / sign
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / f"{vid_id}_{i}.json"
                clip_id = f"{sign}/{vid_id}_{i}"
                if out_path.exists() and not args.force:
                    payload = json.loads(out_path.read_text(encoding="utf-8"))
                    writer.add(clip_id, sign, f"msasl_{e.get('signer_id', '?')}", e["_split"], clip_stats(payload))
                    skip += 1
                    continue
                pending.append((i, e, sign, out_path, clip_id))
            if not pending:
                continue

            tmp = str(tmp_dir / f"msasl_{vid_id}.mp4")
            try:
                if not download(url, tmp):
                    fail += len(pending)
                    continue
                for i, e, sign, out_path, clip_id in pending:
                    payload = extract_time_range(tmp, capture, sign, e["start_time"], e["end_time"])
                    if payload is None or not any(fr["hands"] for fr in payload["frames"]):
                        fail += 1
                        continue
                    out_path.write_text(json.dumps(payload), encoding="utf-8")
                    stats = clip_stats(payload)
                    writer.add(clip_id, sign, f"msasl_{e.get('signer_id', '?')}", e["_split"], stats)
                    ok += 1
                    print(f"  + {clip_id} frames={stats['n_frames']} cover={stats['hand_coverage']}")
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)

    writer.flush()
    print(f"[msasl] done: ok={ok} fail={fail} skip={skip} (yield {ok}/{ok + fail} downloadable)")


if __name__ == "__main__":
    main()
