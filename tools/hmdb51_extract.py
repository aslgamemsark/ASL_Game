"""Extract a relevant subset of HMDB51 as NO_SIGN training clips (-> Frame JSON).

Only the classes that resemble real non-signing behavior in front of a webcam are used — daily
gestures/actions a user might actually do while not signing (wave, clap, brush hair, drink, eat,
talk, smile, chew, smoke). The rest of HMDB51 (sports, instrument-playing, etc.) is irrelevant to
this app's domain and is never even opened.

Caps clips per class (default 50) rather than processing all ~130-200 clips/class HMDB51 ships —
the target NO_SIGN class size is "roughly the sum of all real sign classes combined" (per the ML
hardening plan), not "as much negative data as exists"; overshooting skews training toward
recognizing HMDB51's specific look rather than genuinely-random motion in general.

    python -m tools.hmdb51_extract --zip data/hmdb51/raw/hmdb51.zip --out data/hmdb51/landmarks
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise ImportError("hmdb51_extract needs opencv-python") from exc

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.capture import Capture                                        # noqa: E402
from tools.extract_dataset import extract_video, clip_stats, ManifestWriter  # noqa: E402

# HMDB51 classes that plausibly resemble non-signing behavior in front of a webcam. Excludes
# sports/instrument/vehicle classes entirely (wrong domain — see ML hardening plan's Assessment).
RELEVANT_CLASSES = [
    "brush_hair", "wave", "clap", "drink", "eat", "talk", "smile", "chew", "smoke",
]


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract an HMDB51 subset as NO_SIGN clips.")
    ap.add_argument("--zip", default="data/hmdb51/raw/hmdb51.zip")
    ap.add_argument("--out", default="data/hmdb51/landmarks")
    ap.add_argument("--per-class", type=int, default=50)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    zf = zipfile.ZipFile(args.zip)
    names = zf.namelist()

    writer = ManifestWriter(args.out)
    ok = fail = skip = 0
    with Capture() as capture:
        for cls in RELEVANT_CLASSES:
            members = sorted(n for n in names if n.startswith(f"hmdb51/{cls}/") and n.endswith(".avi"))
            members = members[:args.per_class]
            print(f"[hmdb51] {cls}: {len(members)} clips selected")

            out_dir = Path(args.out) / "NO_SIGN"
            out_dir.mkdir(parents=True, exist_ok=True)

            for i, member in enumerate(members):
                stem = Path(member).stem
                out_path = out_dir / f"{cls}_{stem}.json"
                clip_id = f"NO_SIGN/{cls}_{stem}"
                # Deterministic 70/15/15 split BY INDEX within each class — every clip
                # previously defaulted to "train" (a real bug: NO_SIGN never appeared in val/
                # test, so no_sign_metrics() always computed 0/0 -> silently uninformative
                # rather than actually measuring rejection on held-out nonsense).
                split = "train" if i % 20 < 14 else ("val" if i % 20 < 17 else "test")

                if out_path.exists() and not args.force:
                    payload = json.loads(out_path.read_text(encoding="utf-8"))
                    writer.add(clip_id, "NO_SIGN", f"hmdb51_{cls}", split, clip_stats(payload))
                    skip += 1
                    continue

                tmp_path = None
                try:
                    with zf.open(member) as src, \
                            tempfile.NamedTemporaryFile(suffix=".avi", delete=False) as tmp:
                        tmp.write(src.read())
                        tmp_path = tmp.name
                    payload = extract_video(tmp_path, capture, "NO_SIGN", apply_filter=True)
                    if not any(fr["hands"] for fr in payload["frames"]):
                        fail += 1
                        continue
                    out_path.write_text(json.dumps(payload), encoding="utf-8")
                    stats = clip_stats(payload)
                    writer.add(clip_id, "NO_SIGN", f"hmdb51_{cls}", split, stats)
                    ok += 1
                    print(f"  + {clip_id} frames={stats['n_frames']} cover={stats['hand_coverage']}")
                except (IOError, OSError) as e:
                    print(f"  ! failed {clip_id}: {e}")
                    fail += 1
                finally:
                    if tmp_path and os.path.exists(tmp_path):
                        os.unlink(tmp_path)

    writer.flush()
    print(f"[hmdb51] done: ok={ok} fail={fail} skip={skip}")


if __name__ == "__main__":
    main()
