"""Encodes rendered 3D-LEX word PNG frame sequences into H.264 MP4s for web/public/clips/,
using imageio-ffmpeg (bundles its own ffmpeg binary — no system ffmpeg install needed).

Counterpart to encode_clips.py (which is StudioGalt-only and skips a T-pose calibration frame 1
that StudioGalt sources have). 3D-LEX GLB sources do NOT have that calibration frame — frame 1 is
already a natural rest pose (verified visually) — so encoding starts at frame 1, no skip.

Run render_demo_clips.py for each word first (see docs/3DLEX_ANIMATION_PIPELINE_HANDOFF.md), then
run this script from the repo root: python data/galt_archive/encode_3dlex_clips.py
"""
from pathlib import Path
import subprocess
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FRAMES_ROOT = Path("data/galt_archive/demo_clips")
OUT_DIR = Path("web/public/clips")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Sign name (matches web/src/data/signs.ts clip key) -> 3D-LEX GLB basename (matches
# data/3dlex/ANIM_GLB_converted/<name>.glb, lowercase per the dataset's own naming).
SIGNS = {
    "WANT": "want",
    "YES": "yes",
    "HELP": "help",
    "WATER": "water",
    "HOSPITAL": "hospital",
    "DOCTOR": "doctor",
    "NURSE": "nurse",
    "TEACHER": "teacher",
    "WRITE": "write",
    "READ": "read",
}

for sign in SIGNS:
    frame_dir = FRAMES_ROOT / f"3dlex_{sign}_frames"
    files = sorted(frame_dir.glob("f*.png"))
    if not files:
        print(f"FAIL: no frames found for {sign} in {frame_dir}")
        continue
    out_path = OUT_DIR / f"{sign}.mp4"
    cmd = [
        FFMPEG, "-y",
        "-framerate", "24",
        "-i", str(frame_dir / "f%04d.png"),
        "-frames:v", str(len(files)),
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAIL encoding {sign}:\n{result.stderr[-1500:]}")
        continue
    size_kb = out_path.stat().st_size / 1024
    print(f"{sign}: {len(files)} frames -> {out_path} ({size_kb:.0f} KB)")
