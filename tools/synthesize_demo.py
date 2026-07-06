"""Render procedural-avatar reference clips and run the calibration gate.

Usage (from the repo root, using the project venv):

    python -m tools.synthesize_demo                 # all registered signs -> reference_clips/*.gif
    python -m tools.synthesize_demo COFFEE PLEASE   # just these signs
    python -m tools.synthesize_demo --static        # also render frozen 'confusor' clips
    python -m tools.synthesize_demo --no-gif        # calibration table only, skip rendering

For each sign it: (1) synthesizes the animation from its schema, (2) renders an animated GIF into
reference_clips/, (3) runs the automated bilateral gate (animated clip must pass the verifier; a
frozen copy of any movement sign must fail), and (4) records the result in calibration_log.json.
Finally it prints the calibration checklist table. Human reviewers then watch the GIFs and approve
signs via core.calibration (mark_reviewed).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from core.calibration import CalibrationLog                     # noqa: E402
from core.render import render_gif, render_video                # noqa: E402
from core.synthesis import synthesize                           # noqa: E402
from core.verifier import verify                                # noqa: E402
from signs import SIGNS                                         # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Procedural ASL avatar synthesis demo.")
    ap.add_argument("signs", nargs="*", help="Sign names to render (default: all registered signs).")
    ap.add_argument("--out", default=str(REPO / "reference_clips"), help="Output directory for clips.")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--format", choices=["mp4", "gif", "both"], default="mp4",
                    help="Clip format to render (default: mp4 — scrub/pause in any video player).")
    ap.add_argument("--scores", action="store_true",
                    help="Burn the verifier scorecard (per-parameter bars + PASS/FAIL) into the clip.")
    ap.add_argument("--speed", type=float, default=0.5,
                    help="Playback speed; <1.0 is slower (default 0.5 = half speed).")
    ap.add_argument("--repeats", type=int, default=3, help="Loop the clip N times in the mp4.")
    ap.add_argument("--static", action="store_true", help="Also render a frozen confusor clip per sign.")
    ap.add_argument("--no-gif", action="store_true", help="Skip rendering; run the calibration gate only.")
    args = ap.parse_args(argv)

    names = [s.upper() for s in args.signs] or list(SIGNS.keys())
    unknown = [n for n in names if n not in SIGNS]
    if unknown:
        ap.error(f"unknown sign(s): {', '.join(unknown)}. Known: {', '.join(sorted(SIGNS))}")

    out = Path(args.out)
    log = CalibrationLog().load()
    print(f"Synthesizing {len(names)} sign(s)" + ("" if args.no_gif else f" -> {out}"))

    def _render(anim, stem, caption, result):
        written = []
        if args.format in ("mp4", "both"):
            written.append(render_video(anim, out / f"{stem}.mp4", caption=caption, result=result,
                                        speed=args.speed, repeats=args.repeats).name)
        if args.format in ("gif", "both"):
            written.append(render_gif(anim, out / f"{stem}.gif", caption=caption, result=result,
                                      speed=args.speed).name)
        return written

    for name in names:
        sign = SIGNS[name]
        res = log.record_self_verify(sign)
        line = f"  {name:10} verifier:{res.summary()}"
        if not args.no_gif:
            anim = synthesize(sign, fps=args.fps)
            scorecard = verify(anim.buffer(), sign) if args.scores else None
            written = _render(anim, name, name, scorecard)
            line += "   -> " + ", ".join(written)
            if args.static:
                frozen = synthesize(sign, fps=args.fps, static=True)
                frozen_scores = verify(frozen.buffer(), sign) if args.scores else None
                _render(frozen, f"{name}_static", f"{name} (frozen confusor)", frozen_scores)
        print(line)

    log.save()
    print("\n" + log.table())
    print(f"\nCalibration log written to {log.path}")
    shippable = log.shippable_ids()
    print(f"Shippable now (verifier_passed AND avatar_approved): {shippable or 'none - awaiting human review'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
