"""Classroom presentation/theme.

Renders the gamified screen from a GameSession: a chalkboard-green classroom background, a top
HUD (level name, prompt progress bar, level score + running total), the current prompt, a
picture-in-picture webcam, a success flash, a level-complete card, and a finished summary.
Recognition is NOT here — this only renders the session state it's given. Same shape as
scenarios/coffee_shop/scene.py, reusing core/game.py's shared PiP + flash helpers.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from core import game

ASSETS = Path(__file__).parent / "assets"

FONT = cv2.FONT_HERSHEY_SIMPLEX
INK = (245, 245, 245)
ACCENT = (255, 200, 90)
GOOD = (90, 210, 130)
BOARD_GREEN = (52, 74, 40)


def _center(canvas, text, y, scale, color, thick=2):
    (tw, _), _ = cv2.getTextSize(text, FONT, scale, thick)
    cv2.putText(canvas, text, ((canvas.shape[1] - tw) // 2, y), FONT, scale, color, thick, cv2.LINE_AA)


class ClassroomScene:
    def __init__(self, width: int = 1280, height: int = 720):
        self.W, self.H = width, height
        self.bg = self._load_or_make_background()

    # ----------------------------------------------------------------- background
    def _load_or_make_background(self):
        path = ASSETS / "background.png"
        if path.exists():
            img = cv2.imread(str(path))
            if img is not None:
                return cv2.resize(img, (self.W, self.H))
        return self._procedural_background()

    def _procedural_background(self):
        W, H = self.W, self.H
        bg = np.zeros((H, W, 3), np.uint8)
        bg[:, :] = BOARD_GREEN
        # chalkboard frame
        cv2.rectangle(bg, (30, 130), (W - 30, int(H * 0.72)), (40, 58, 30), 6)
        cv2.putText(bg, "A B C", (70, 220), FONT, 1.4, (225, 225, 210), 3, cv2.LINE_AA)
        # floor
        cv2.rectangle(bg, (0, int(H * 0.72)), (W, H), (95, 75, 55), -1)
        cv2.putText(bg, "ROOM 101", (40, int(H * 0.68)), FONT, 1.0, (220, 220, 220), 2, cv2.LINE_AA)
        return bg

    # ----------------------------------------------------------------- HUD pieces
    def _hud(self, canvas, session):
        ov = canvas.copy()
        cv2.rectangle(ov, (0, 0), (self.W, 110), (24, 32, 20), -1)
        cv2.addWeighted(ov, 0.6, canvas, 0.4, 0, canvas)
        cv2.putText(canvas, session.level.name, (24, 38), FONT, 0.8, INK, 2, cv2.LINE_AA)
        cv2.putText(canvas, f"Sign {session.prompt_number} / {session.level_len}", (24, 68),
                    FONT, 0.6, (200, 215, 195), 1, cv2.LINE_AA)
        bx, by, bw = 24, 84, 360
        frac = (session.prompt_idx) / max(session.level_len, 1)
        cv2.rectangle(canvas, (bx, by), (bx + bw, by + 12), (70, 80, 65), -1)
        cv2.rectangle(canvas, (bx, by), (bx + int(bw * frac), by + 12), GOOD, -1)
        cv2.putText(canvas, f"Level: {session.level_score}/{session.level_max}", (self.W - 300, 40),
                    FONT, 0.7, ACCENT, 2, cv2.LINE_AA)
        cv2.putText(canvas, f"TOTAL: {session.total_score}", (self.W - 300, 74),
                    FONT, 0.8, (90, 230, 140), 2, cv2.LINE_AA)

    def _prompt(self, canvas, session):
        p = session.prompt
        _center(canvas, p.sign.name.replace("_", " "), 230, 1.6, INK, 3)
        _center(canvas, p.text, 280, 0.7, (210, 220, 205), 2)

    # ----------------------------------------------------------------- screens
    def _render_play(self, canvas, session, cam_bgr, now, debug_overlay):
        self._hud(canvas, session)
        self._prompt(canvas, session)
        game.composite_pip(canvas, cam_bgr)
        if session.state == "success":
            prog = session.success_progress(now)
            game.flash(canvas, 0.45 * (1.0 - prog), GOOD)
            _center(canvas, "CORRECT!  +10", self.H // 2 + 30, 1.5, INK, 3)
        if debug_overlay is not None:
            result, move_dbg = debug_overlay
            from core.overlay import draw_param_scores
            draw_param_scores(canvas, result, move_dbg, y0=124)

    def _render_card(self, canvas, session):
        ov = canvas.copy(); cv2.rectangle(ov, (0, 0), (self.W, self.H), (18, 24, 16), -1)
        cv2.addWeighted(ov, 0.7, canvas, 0.3, 0, canvas)
        _center(canvas, "LEVEL COMPLETE", self.H // 2 - 70, 1.6, GOOD, 3)
        _center(canvas, session.level.name, self.H // 2 - 10, 0.9, INK, 2)
        _center(canvas, f"Score  {session.level_score} / {session.level_max}", self.H // 2 + 45, 1.1, ACCENT, 2)
        nxt = session.level_idx + 1
        if nxt < len(session.levels):
            _center(canvas, f"Next:  {session.levels[nxt].name}", self.H // 2 + 110, 0.7, (210, 220, 205), 2)

    def _render_finished(self, canvas, session):
        ov = canvas.copy(); cv2.rectangle(ov, (0, 0), (self.W, self.H), (18, 24, 16), -1)
        cv2.addWeighted(ov, 0.75, canvas, 0.25, 0, canvas)
        _center(canvas, "LESSON COMPLETE!", self.H // 2 - 60, 1.7, (90, 230, 140), 3)
        _center(canvas, f"Total score:  {session.total_score}", self.H // 2 + 10, 1.2, ACCENT, 2)
        _center(canvas, "press R to play again   -   Q to quit", self.H // 2 + 80, 0.7, (210, 220, 205), 2)

    # ----------------------------------------------------------------- entry
    def render(self, session, cam_bgr, now: float, debug_overlay=None):
        canvas = self.bg.copy()
        if session.state in ("playing", "success"):
            self._render_play(canvas, session, cam_bgr, now, debug_overlay)
        elif session.state == "level_complete":
            self._render_card(canvas, session)
        elif session.state == "finished":
            self._render_finished(canvas, session)
        return canvas
