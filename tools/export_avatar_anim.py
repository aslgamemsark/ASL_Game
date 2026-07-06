"""Export every registered sign as a 3D avatar animation track (JSON) for the Three.js viewer.

Writes one <SIGN>.json per sign plus an index.json into the target directory (default:
D:/asl-synthesis/anim). The viewer (D:/asl-synthesis/app.js) loads these and drives the Ready Player
Me skeleton. Run from the repo root with the project venv:

    python -m tools.export_avatar_anim
    python -m tools.export_avatar_anim --out D:/asl-synthesis/anim
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from core.synthesis3d import build_animation     # noqa: E402
from signs import SIGNS                           # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Export 3D avatar animation tracks.")
    ap.add_argument("signs", nargs="*", help="Sign names to export (default: all; index.json only "
                    "rewritten when exporting all).")
    ap.add_argument("--out", default="D:/asl-synthesis/anim")
    ap.add_argument("--fps", type=float, default=30.0)
    args = ap.parse_args(argv)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    subset = [s.upper() for s in args.signs]
    names = subset or list(SIGNS.keys())
    for name in names:
        anim = build_animation(SIGNS[name], fps=args.fps)
        (out / f"{name}.json").write_text(json.dumps(anim), encoding="utf-8")
    if not subset:                                   # don't clobber a trimmed viewer index
        (out / "index.json").write_text(json.dumps({"signs": names}), encoding="utf-8")
    print(f"exported {len(names)} animation(s) -> {out}")
    print(", ".join(names))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
