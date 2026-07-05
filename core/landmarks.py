"""Frame model, rolling buffer, and shoulder-width normalization.

This is the data backbone every later phase builds on:
  - Hand / Frame: one timestamped sample (21 landmarks/hand + pose shoulder points), stored in
    PIXEL coordinates so x and y share a unit regardless of webcam aspect ratio.
  - RollingBuffer: a fixed ~1.5-2s time window of Frames — the ONLY thing movement checks read.
  - normalized_distance(): every distance expressed as a ratio of shoulder width, so thresholds
    don't break when the user sits closer to or further from the camera.

Frames are JSON-serializable (to_dict/from_dict) so the Phase 4 recorder can save fixtures and
the confusor tests can replay them.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Iterator, Optional

import numpy as np

# --- MediaPipe hand landmark indices (21-point model) ---
WRIST = 0
THUMB_TIP = 4
INDEX_MCP, INDEX_PIP, INDEX_TIP = 5, 6, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP = 9, 10, 12
RING_MCP, RING_TIP = 13, 16
PINKY_MCP, PINKY_TIP = 17, 20
FINGERTIPS = (THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP)
MCPS = (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP)
PALM_POINTS = (WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP)

# --- MediaPipe pose landmark indices (33-point model) ---
POSE_NOSE = 0
POSE_MOUTH_LEFT = 9
POSE_MOUTH_RIGHT = 10
POSE_LEFT_SHOULDER = 11
POSE_RIGHT_SHOULDER = 12
POSE_LEFT_ELBOW = 13
POSE_RIGHT_ELBOW = 14
POSE_LEFT_WRIST = 15
POSE_RIGHT_WRIST = 16
POSE_LEFT_HIP = 23
POSE_RIGHT_HIP = 24


@dataclass
class Hand:
    """One detected hand: 21 landmarks in pixel coords (x, y) plus relative depth (z)."""

    handedness: str            # "Left" or "Right", from the image's perspective
    points: np.ndarray         # shape (21, 3): x_px, y_px, z (MediaPipe relative depth)
    # OPTIONAL, additive (avatar video-retarget pipeline only — see docs/VIDEO_RETARGET_HANDOFF.md).
    # MediaPipe HandLandmarker's `hand_world_landmarks`: shape (21, 3), METERS, roughly hand-centered
    # (NOT wrist-relative, NOT pixel-space, NOT the same origin as `points`). None when not requested
    # or not detected. Existing recognition/training consumers never read this field.
    world_points: Optional[np.ndarray] = None

    @property
    def wrist(self) -> np.ndarray:
        return self.points[WRIST, :2]

    @property
    def center(self) -> np.ndarray:
        """Palm-center proxy: mean of wrist + finger MCPs (x, y in px). Stable pivot for motion."""
        return self.points[list(PALM_POINTS), :2].mean(axis=0)

    def to_dict(self) -> dict:
        d = {"handedness": self.handedness, "points": self.points.tolist()}
        if self.world_points is not None:
            d["world_points"] = self.world_points.tolist()
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Hand":
        wp = d.get("world_points")
        return cls(
            handedness=d["handedness"],
            points=np.asarray(d["points"], dtype=float),
            world_points=None if wp is None else np.asarray(wp, dtype=float),
        )


@dataclass
class Frame:
    """One timestamped capture: any detected hands + shoulder points for scale normalization."""

    t: float                                          # timestamp, seconds (monotonic)
    width: int                                        # source image width (px)
    height: int                                       # source image height (px)
    hands: list[Hand] = field(default_factory=list)   # 0..2 hands, in detection order
    left_shoulder: Optional[np.ndarray] = None        # (x, y) px
    right_shoulder: Optional[np.ndarray] = None       # (x, y) px
    mouth: Optional[np.ndarray] = None                # (x, y) px — real face anchor for chin signs
    # OPTIONAL, additive (avatar video-retarget pipeline only — see docs/VIDEO_RETARGET_HANDOFF.md).
    # MediaPipe PoseLandmarker's `pose_world_landmarks`: METERS, origin at the mid-hip point (that
    # joint is always ~(0,0,0)). Keys present only for joints actually detected this frame:
    # left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist, left_hip,
    # right_hip — each a (3,) np.ndarray. None (the whole dict) when not requested or pose missed
    # entirely this frame. Existing recognition/training consumers never read this field.
    pose_world: Optional[dict] = None
    # OPTIONAL, additive (facial non-manual marker support). MediaPipe FaceLandmarker's
    # `face_blendshapes`, requested only when `Capture(want_face_blendshapes=True)`: the 52
    # ARKit-standard blendshape scores in [0, 1], keyed by category name (e.g. "browInnerUp",
    # "mouthPucker"). None when not requested or no face detected this frame. Existing
    # recognition/training consumers never read this field.
    face_blendshapes: Optional[dict] = None

    @property
    def shoulder_width(self) -> Optional[float]:
        """Scale reference in px. None if pose/shoulders weren't detected."""
        if self.left_shoulder is None or self.right_shoulder is None:
            return None
        w = float(np.linalg.norm(self.left_shoulder - self.right_shoulder))
        return w if w > 1e-6 else None

    def hand(self, handedness: str) -> Optional[Hand]:
        """First hand matching 'Left'/'Right', or None."""
        for h in self.hands:
            if h.handedness == handedness:
                return h
        return None

    @property
    def has_both_hands(self) -> bool:
        return len(self.hands) >= 2

    @property
    def is_complete(self) -> bool:
        """Enough data to evaluate a two-handed sign: both hands + a shoulder scale."""
        return self.has_both_hands and self.shoulder_width is not None

    def to_dict(self) -> dict:
        d = {
            "t": self.t,
            "width": self.width,
            "height": self.height,
            "hands": [h.to_dict() for h in self.hands],
            "left_shoulder": None if self.left_shoulder is None else self.left_shoulder.tolist(),
            "right_shoulder": None if self.right_shoulder is None else self.right_shoulder.tolist(),
            "mouth": None if self.mouth is None else self.mouth.tolist(),
        }
        if self.pose_world is not None:
            d["pose_world"] = {k: v.tolist() for k, v in self.pose_world.items()}
        if self.face_blendshapes is not None:
            d["face_blendshapes"] = dict(self.face_blendshapes)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Frame":
        pw = d.get("pose_world")
        return cls(
            t=d["t"],
            width=d["width"],
            height=d["height"],
            hands=[Hand.from_dict(h) for h in d["hands"]],
            left_shoulder=None if d.get("left_shoulder") is None else np.asarray(d["left_shoulder"], float),
            right_shoulder=None if d.get("right_shoulder") is None else np.asarray(d["right_shoulder"], float),
            mouth=None if d.get("mouth") is None else np.asarray(d["mouth"], float),
            pose_world=None if pw is None else {k: np.asarray(v, float) for k, v in pw.items()},
            face_blendshapes=d.get("face_blendshapes"),
        )


def normalized_distance(p1, p2, shoulder_width: float) -> float:
    """Euclidean distance between two pixel points, as a ratio of shoulder width."""
    return float(np.linalg.norm(np.asarray(p1, float) - np.asarray(p2, float)) / shoulder_width)


class RollingBuffer:
    """A fixed time-window (seconds) of Frames. The basis for every movement check.

    Old frames are evicted as new ones arrive, so the buffer always holds roughly the last
    `window_seconds` of motion — never a single frame. Movement detectors read start/end and
    iterate the window; they never look at just the current frame.
    """

    def __init__(self, window_seconds: float = 2.0):
        self.window_seconds = window_seconds
        self._frames: deque[Frame] = deque()

    def add(self, frame: Frame) -> None:
        self._frames.append(frame)
        cutoff = frame.t - self.window_seconds
        while self._frames and self._frames[0].t < cutoff:
            self._frames.popleft()

    def clear(self) -> None:
        self._frames.clear()

    def __len__(self) -> int:
        return len(self._frames)

    def __iter__(self) -> Iterator[Frame]:
        return iter(self._frames)

    @property
    def frames(self) -> list[Frame]:
        return list(self._frames)

    @property
    def start(self) -> Optional[Frame]:
        return self._frames[0] if self._frames else None

    @property
    def end(self) -> Optional[Frame]:
        return self._frames[-1] if self._frames else None

    @property
    def duration(self) -> float:
        """Seconds spanned by the buffer (0 until at least two frames are present)."""
        return (self._frames[-1].t - self._frames[0].t) if len(self._frames) >= 2 else 0.0


class HandStabilizer:
    """Bridge brief hand-detection dropouts by carrying a recently-seen hand forward.

    MediaPipe intermittently loses a hand for a frame or two — closed fists especially, and worse
    in poor light. For LIVE PLAY, hold the last-seen hand for up to `hold_seconds` so a momentary
    miss doesn't reset location/handshape scoring (the flicker users feel as "it keeps dropping").

    Do NOT use this when recording fixtures — training data must stay raw/honest. The carried
    hand keeps its last position, which is exactly right for the held-still non-dominant fist and
    harmless for the brief gaps it bridges.
    """

    def __init__(self, hold_seconds: float = 0.3):
        self.hold_seconds = hold_seconds
        self._last: dict[str, tuple[float, Hand]] = {}

    def reset(self) -> None:
        self._last.clear()

    def stabilize(self, frame: Frame) -> Frame:
        """Update memory with the frame's real hands, then re-add any recently-seen missing ones."""
        present = set()
        for h in frame.hands:
            self._last[h.handedness] = (frame.t, h)
            present.add(h.handedness)
        for handedness, (t_seen, hand) in self._last.items():
            if handedness not in present and (frame.t - t_seen) <= self.hold_seconds:
                frame.hands.append(hand)
        return frame
