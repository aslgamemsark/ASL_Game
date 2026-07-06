"""Preview renderer — the medium-agnostic 'reference clip' for the lesson loop / calibration GUI.

The lesson loop shows the learner a reference of each sign, then asks them to perform it (validated
by `core.verifier`). The procedural-avatar report stresses that this reference slot must be medium
agnostic: it should not care whether the clip is recorded human video or a procedurally generated
avatar. This module renders a synthesized `Animation` to an animated GIF a human reviewer (or
learner) can watch — the calibration GUI's viewer, in 2D.

It deliberately uses the SAME math as the rest of the pipeline: arms are placed with the analytical
2-bone IK solver (`core.ik`) driving each wrist to the synthesized hand position, so what you watch
is what the verifier scores. The avatar is intentionally stick-figure / low-poly stylized — the
report notes a stylized aesthetic sidesteps the uncanny valley and keeps attention on the linguistic
content rather than on micro-imperfections of procedural motion.

Pillow only (no ffmpeg/matplotlib), so it runs anywhere the recognition stack already runs.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from core.ik import solve_two_bone
from core.synthesis import Animation, Body

# MediaPipe hand bone topology (pairs of landmark indices to connect).
_HAND_BONES = [
    (0, 1), (1, 2), (2, 3), (3, 4),            # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),            # index
    (0, 9), (9, 10), (10, 11), (11, 12),       # middle
    (0, 13), (13, 14), (14, 15), (15, 16),     # ring
    (0, 17), (17, 18), (18, 19), (19, 20),     # pinky
    (5, 9), (9, 13), (13, 17),                 # knuckle bridge
]

_BG = (18, 22, 30)
_BODY = (70, 80, 96)
_ARM = (150, 162, 180)
_HAND = (120, 200, 255)
_JOINT = (235, 245, 255)
_TEXT = (210, 218, 230)
_PASS = (120, 230, 140)
_FAIL = (240, 120, 120)
_BAR_BG = (60, 68, 82)
_TICK = (225, 210, 120)


def _arm_lengths(body: Body) -> tuple[float, float]:
    # Upper arm and forearm, sized so any synthesized hand target stays comfortably within reach.
    return 0.62 * body.shoulder_width, 0.62 * body.shoulder_width


def _draw_arm(draw: ImageDraw.ImageDraw, shoulder, wrist, body: Body) -> None:
    l1, l2 = _arm_lengths(body)
    pole = np.array([shoulder[0], shoulder[1] + 1.4 * body.shoulder_width, 0.6 * body.shoulder_width])
    pose = solve_two_bone(shoulder, wrist, l1, l2, pole=pole)
    s, e, w = pose.shoulder[:2], pose.elbow[:2], pose.wrist[:2]
    draw.line([tuple(s), tuple(e)], fill=_ARM, width=7)
    draw.line([tuple(e), tuple(w)], fill=_ARM, width=7)
    for j in (s, e):
        draw.ellipse(_dot(j, 5), fill=_BODY)


def _dot(p, r):
    return [p[0] - r, p[1] - r, p[0] + r, p[1] + r]


def _draw_hand(draw: ImageDraw.ImageDraw, pts: np.ndarray) -> None:
    for a, b in _HAND_BONES:
        draw.line([tuple(pts[a, :2]), tuple(pts[b, :2])], fill=_HAND, width=3)
    for i in range(21):
        draw.ellipse(_dot(pts[i, :2], 2.4), fill=_JOINT)


def _nearest_shoulder(body: Body, wrist: np.ndarray) -> np.ndarray:
    ls, rs = body.left_shoulder, body.right_shoulder
    return ls if np.linalg.norm(wrist - ls) <= np.linalg.norm(wrist - rs) else rs


def _draw_scorecard(draw: ImageDraw.ImageDraw, result, body: Body) -> None:
    """Per-parameter verifier readout: a bar per parameter with its pass threshold ticked.

    Lets a reviewer judge the avatar both visually AND numerically — green overall means the SAME
    verifier the learner is graded by recognizes the avatar's pose as this sign.
    """
    x0 = body.width - 196
    y = 14
    overall = "PASS" if result.passed else "FAIL"
    draw.text((x0, y), f"verifier: {overall}", fill=_PASS if result.passed else _FAIL)
    y += 20
    bw = 130
    for p in result.params:
        ok = p.cleared if p.required else True
        col = _PASS if ok else _FAIL
        label = p.name.replace("handshape_", "hs:")
        if not p.required:
            label += " (opt)"
        draw.text((x0, y), f"{label}", fill=_TEXT)
        bx, by = x0, y + 12
        draw.rectangle([bx, by, bx + bw, by + 6], fill=_BAR_BG)
        draw.rectangle([bx, by, bx + int(bw * min(p.score, 1.0)), by + 6], fill=col)
        tx = bx + int(bw * min(p.threshold, 1.0))
        draw.line([(tx, by - 2), (tx, by + 8)], fill=_TICK, width=1)
        draw.text((bx + bw + 6, y), f"{p.score:.2f}", fill=_TEXT)
        y += 26


def render_frame(frame, body: Body, caption: str | None = None, result=None) -> Image.Image:
    img = Image.new("RGB", (body.width, body.height), _BG)
    draw = ImageDraw.Draw(img)

    # torso: shoulder line + neck + head (kept connected so the figure reads as one body)
    ls, rs, mouth = body.left_shoulder, body.right_shoulder, body.mouth
    sw = body.shoulder_width
    draw.line([tuple(rs), tuple(ls)], fill=_BODY, width=9)
    head_r = 0.26 * sw
    head_c = np.array([body.mid[0], mouth[1] - 0.18 * sw])
    neck_bottom = body.mid
    neck_top = np.array([body.mid[0], head_c[1] + head_r])
    draw.line([tuple(neck_bottom), tuple(neck_top)], fill=_BODY, width=9)
    draw.ellipse(_dot(head_c, head_r), outline=_BODY, width=6)
    # mouth marker — the real anchor chin/forehead signs are scored against
    draw.ellipse(_dot(mouth, 3), fill=_BODY)

    # arms (IK) then hands, so hands draw on top
    for h in frame.hands:
        _draw_arm(draw, _nearest_shoulder(body, h.wrist), h.wrist, body)
    for h in frame.hands:
        _draw_hand(draw, h.points)

    if caption:
        draw.text((16, 14), caption, fill=_TEXT)
    if result is not None:
        _draw_scorecard(draw, result, body)
    return img


def _frames(animation: Animation, body: Body, caption: str | None, result) -> list[Image.Image]:
    cap = caption if caption is not None else animation.sign_name
    return [render_frame(f, body, caption=cap, result=result) for f in animation.frames]


def render_gif(animation: Animation, path: Path | str, body: Body | None = None,
               caption: str | None = None, loops: int = 0, result=None,
               speed: float = 1.0) -> Path:
    """Render an Animation to an animated GIF. `speed` < 1.0 slows playback. Returns the path."""
    body = body or Body()
    images = _frames(animation, body, caption, result)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    per_frame_ms = int(1000.0 / max(animation.fps * speed, 1.0))
    images[0].save(
        path, save_all=True, append_images=images[1:],
        duration=per_frame_ms, loop=loops, disposal=2, optimize=True,
    )
    return path


def render_video(animation: Animation, path: Path | str, body: Body | None = None,
                 caption: str | None = None, result=None, speed: float = 0.5,
                 repeats: int = 3) -> Path:
    """Render an Animation to an MP4 you can scrub/pause in any player.

    `speed` < 1.0 plays slower (default half-speed, easier to inspect a pose); `repeats` loops the
    clip so a short sign is easy to watch. Pass `result` (a VerifyResult) to burn the per-parameter
    scorecard into the frame. Requires OpenCV (already a project dependency).
    """
    import cv2

    body = body or Body()
    images = _frames(animation, body, caption, result)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fps_out = max(animation.fps * speed, 1.0)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps_out, (body.width, body.height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {path} (codec/ffmpeg issue)")
    try:
        for _ in range(max(repeats, 1)):
            for img in images:
                writer.write(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
    finally:
        writer.release()
    return path
