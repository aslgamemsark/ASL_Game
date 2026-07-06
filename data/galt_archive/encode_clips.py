"""Encodes each sign's rendered PNG frame sequence into an H.264 MP4 for web/public/clips/,
using imageio-ffmpeg (bundles its own ffmpeg binary — no system ffmpeg install needed).

Skips frame 1 of every sequence: StudioGalt archive FBX exports carry a T-pose calibration frame
at frame 1 (confirmed present in HELLO/PLEASE/BREATHE/letters, absent in COFFEE/YOU) before the
real captured motion begins at frame 2 — encoding it would flash a jarring T-pose at the start of
every loop. Frame 2 onward already returns to a matching rest pose at both ends (verified by
comparing frame 2 against the final frames of each clip), so the loop is seamless either way.
"""
import glob
import subprocess
from pathlib import Path
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FRAMES_ROOT = Path("data/galt_archive/demo_clips")
OUT_DIR = Path("web/public/clips")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIGNS = {
    "COFFEE": "coffee_frames",
    "HELLO": "HELLO_frames",
    "PLEASE": "PLEASE_frames",
    "YOU": "YOU_frames",
    "BREATHE": "BREATHE_frames",
    "LETTER_A": "LETTER_A_frames",
    "LETTER_B": "LETTER_B_frames",
    "LETTER_L": "LETTER_L_frames",
    "LETTER_V": "LETTER_V_frames",
    "LETTER_Y": "LETTER_Y_frames",
    "LETTER_W": "LETTER_W_frames",
    "LETTER_I": "LETTER_I_frames",
    "LETTER_C": "LETTER_C_frames",
    "LETTER_D": "LETTER_D_frames",
    "LETTER_E": "LETTER_E_frames",
    "LETTER_F": "LETTER_F_frames",
    "LETTER_G": "LETTER_G_frames",
    "LETTER_H": "LETTER_H_frames",
    "LETTER_J": "LETTER_J_frames",
    "LETTER_K": "LETTER_K_frames",
    "LETTER_M": "LETTER_M_frames",
    "LETTER_N": "LETTER_N_frames",
    "LETTER_O": "LETTER_O_frames",
    "LETTER_P": "LETTER_P_frames",
    "LETTER_Q": "LETTER_Q_frames",
    "LETTER_R": "LETTER_R_frames",
    "LETTER_S": "LETTER_S_frames",
    "LETTER_T": "LETTER_T_frames",
    "LETTER_U": "LETTER_U_frames",
    "LETTER_X": "LETTER_X_frames",
    "LETTER_Z": "LETTER_Z_frames",
}

for sign, folder in SIGNS.items():
    frame_dir = FRAMES_ROOT / folder
    files = sorted(frame_dir.glob("f*.png"))
    if not files:
        print(f"FAIL: no frames found for {sign} in {frame_dir}")
        continue
    out_path = OUT_DIR / f"{sign}.mp4"
    cmd = [
        FFMPEG, "-y",
        "-start_number", "2",  # skip frame 1 (T-pose calibration frame, see docstring)
        "-framerate", "24",
        "-i", str(frame_dir / "f%04d.png"),
        "-frames:v", str(len(files) - 1),
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
    print(f"{sign}: {len(files)-1} frames -> {out_path} ({size_kb:.0f} KB)")
