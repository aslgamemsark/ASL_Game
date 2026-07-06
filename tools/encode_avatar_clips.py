"""Encode captured avatar PNG frame sequences into looped, slowed MP4 reference clips.

The Three.js capture (D:/asl-synthesis/capture.mjs) writes one PNG per animation frame into
frames/<SIGN>/. This turns each sequence into reference_clips/<SIGN>.mp4 — played slower and looped a
few times so a short sign is easy to inspect, the same treatment the 2D reference clips got.

    python -m tools.encode_avatar_clips                       # all captured signs
    python -m tools.encode_avatar_clips COFFEE WATER          # just these
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

DEF_FRAMES = Path("D:/asl-synthesis/frames")
DEF_OUT = Path("D:/asl-synthesis/reference_clips")


def encode(sign: str, frames_dir: Path, out_dir: Path, fps_out: float, repeats: int) -> Path | None:
    pngs = sorted((frames_dir / sign).glob("f*.png"))
    if not pngs:
        print(f"  {sign:10} no frames found in {frames_dir / sign}")
        return None
    first = cv2.imread(str(pngs[0]))
    h, w = first.shape[:2]
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{sign}.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps_out, (w, h))
    for _ in range(max(repeats, 1)):
        for p in pngs:
            writer.write(cv2.imread(str(p)))
    writer.release()
    print(f"  {sign:10} {len(pngs)} frames x{repeats} @ {fps_out:.0f}fps -> {path.name} ({path.stat().st_size // 1024}KB)")
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Encode avatar frame captures to MP4.")
    ap.add_argument("signs", nargs="*")
    ap.add_argument("--frames", default=str(DEF_FRAMES))
    ap.add_argument("--out", default=str(DEF_OUT))
    ap.add_argument("--fps-out", type=float, default=15.0)
    ap.add_argument("--repeats", type=int, default=3)
    args = ap.parse_args(argv)

    frames_dir, out_dir = Path(args.frames), Path(args.out)
    names = [s.upper() for s in args.signs] or sorted(
        d.name for d in frames_dir.iterdir() if d.is_dir() and d.name != "cal"
    )
    print(f"Encoding {len(names)} clip(s) -> {out_dir}")
    n = sum(1 for s in names if encode(s, frames_dir, out_dir, args.fps_out, args.repeats))
    print(f"done: {n}/{len(names)} clips")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
