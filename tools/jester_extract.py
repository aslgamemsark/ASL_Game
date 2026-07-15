"""Extract a sample of the Jester dataset's "Doing other things" / "No gesture" classes as
NO_SIGN training clips (-> Frame JSON).

Unlike tools/hmdb51_extract.py (whole video files, decoded via cv2.VideoCapture), Jester ships
each clip as a numbered directory of already-extracted JPG frames at a fixed 12 fps — this reads
that image sequence directly and feeds each frame through the same core.capture.Capture pipeline,
so the output format is byte-identical to every other extractor in this project.

Jester is a better-matched NO_SIGN source than HMDB51: it was recorded in the same domain as this
app (a laptop/webcam pointed at a person's hands), and ships a purpose-built "No gesture" class
plus a large "Doing other things" catch-all class of casual, non-signing hand motion — closer to
real production nonsense than HMDB51's whole-body action clips.

    python -m tools.jester_extract --frames data/jester/frames/20bn-jester-v1 \
        --selection data/jester/selected_clips.csv --out data/jester/landmarks
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise ImportError("jester_extract needs opencv-python") from exc

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.capture import Capture                                            # noqa: E402
from tools.extract_dataset import clip_stats, ManifestWriter, _smooth_hands_inplace  # noqa: E402

JESTER_FPS = 12.0


def extract_image_sequence(clip_dir: Path, capture: Capture, sign_name: str,
                            apply_filter: bool = True) -> dict | None:
    """Run MediaPipe over one Jester clip's numbered JPG frames."""
    jpgs = sorted(clip_dir.glob("*.jpg"))
    if not jpgs:
        return None
    frames = []
    for idx, jp in enumerate(jpgs):
        bgr = cv2.imread(str(jp))
        if bgr is None:
            continue
        t = idx / JESTER_FPS
        frames.append(capture.process(bgr, timestamp_ms=int(t * 1000), t_seconds=t))
    if not frames:
        return None
    if apply_filter:
        _smooth_hands_inplace(frames)
    return {"sign_name": sign_name, "frames": [f.to_dict() for f in frames]}


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract a Jester NO_SIGN sample as landmark clips.")
    ap.add_argument("--frames", default="data/jester/frames/20bn-jester-v1",
                     help="dir of numbered clip subdirectories (already extracted from the tar)")
    ap.add_argument("--selection", default="data/jester/selected_clips.csv",
                     help="csv with video_id,label columns naming which clips to process")
    ap.add_argument("--out", default="data/jester/landmarks")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-filter", action="store_true")
    args = ap.parse_args()

    frames_root = Path(args.frames)
    with open(args.selection, newline="", encoding="utf-8") as fh:
        selection = list(csv.DictReader(fh))

    out_dir = Path(args.out) / "NO_SIGN"
    out_dir.mkdir(parents=True, exist_ok=True)
    writer = ManifestWriter(args.out)
    ok = fail = skip = 0

    with Capture() as capture:
        for i, row in enumerate(selection):
            vid = row["video_id"]
            clip_dir = frames_root / vid
            stem = f"jester_{vid}"
            out_path = out_dir / f"{stem}.json"
            clip_id = f"NO_SIGN/{stem}"
            # Deterministic 70/15/15 split BY INDEX (same convention as hmdb51_extract.py and
            # make_no_sign_synth.py) so this source actually appears in val/test, not just train.
            split = "train" if i % 20 < 14 else ("val" if i % 20 < 17 else "test")

            if out_path.exists() and not args.force:
                payload = json.loads(out_path.read_text(encoding="utf-8"))
                writer.add(clip_id, "NO_SIGN", "jester", split, clip_stats(payload))
                skip += 1
                continue

            if not clip_dir.exists():
                print(f"  ! missing clip dir: {clip_dir}")
                fail += 1
                continue

            payload = extract_image_sequence(clip_dir, capture, "NO_SIGN",
                                              apply_filter=not args.no_filter)
            if payload is None:
                fail += 1
                continue

            out_path.write_text(json.dumps(payload), encoding="utf-8")
            stats = clip_stats(payload)
            writer.add(clip_id, "NO_SIGN", "jester", split, stats)
            ok += 1
            if ok % 50 == 0:
                print(f"  + {ok} extracted so far (latest {clip_id} frames={stats['n_frames']})")

    writer.flush()
    print(f"[jester] done: ok={ok} fail={fail} skip={skip}")


if __name__ == "__main__":
    main()
