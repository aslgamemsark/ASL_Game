"""Mirror tools/calibrate_from_dataset.py's LOOSEN/TIGHTEN recommendations into the TS engine.

The Python rule verifier (core/verifier.py + signs/*.py) and the TypeScript rule verifier
(web/src/engine/verifier.ts + web/src/engine/signs/index.ts) are two independent implementations
of the SAME geometric rules (see CLAUDE.md: recognition must stay local/client-side, so the web
app needs its own copy, not a server call into the Python engine). Calibration was computed once
from real ASL Citizen/WLASL data against the Python engine; this applies the identical recommended
min_confidence numbers to the TS mirror so both engines stay in sync.

NOTE: web/src/data/signs.ts is NOT touched — that file is UI display text (name/description/hint/
clip) with a coincidentally similar shape; the live recognition schema is @/engine/signs/index.ts
(imported as ENGINE_SIGNS in PracticePage/LessonPage), which is what this patches.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS_SIGNS_PATH = ROOT / "web" / "src" / "engine" / "signs" / "index.ts"
REPORT_PATH = ROOT / "tools" / "calibration_report.json"

PARAM_TO_KEY = {
    "handshape_dominant": "dominant",
    "handshape_nondominant": "nondominant",
    "location": "location",
    "movement": "movement",
    "orientation": "orientation",
    "nmm": "nmm",
}


def _brace_span(src: str, start_after: int) -> tuple[int, int] | None:
    """Given an index just after an opening '{', find the matching '}' by depth counting."""
    depth = 1
    i = start_after
    while i < len(src) and depth > 0:
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
        i += 1
    return start_after, i - 1


def _sign_block_span(src: str, sign_name: str) -> tuple[int, int] | None:
    m = re.search(rf"export const {sign_name}\s*=\s*createSign\(\{{", src)
    if not m:
        return None
    return _brace_span(src, m.end())


def _field_block_span(src: str, start: int, end: int, key: str) -> tuple[int, int] | None:
    scope = src[start:end]
    m = re.search(rf"\b{key}\s*:\s*\{{", scope)
    if not m:
        return None
    inner_start, inner_end = _brace_span(scope, m.end())
    return start + inner_start, start + inner_end


def apply_recommendations() -> list[str]:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    recs = report["recommendations"]

    src = TS_SIGNS_PATH.read_text(encoding="utf-8")
    touched_signs = []

    for sign_name, sign_recs in recs.items():
        changes = {p: r for p, r in sign_recs.items() if r["status"] in ("LOOSEN", "TIGHTEN")}
        if not changes:
            continue
        span = _sign_block_span(src, sign_name)
        if span is None:
            continue  # sign not present in the TS engine (e.g. only in Python vocabulary)
        sign_start, sign_end = span

        any_change = False
        for pname, rec in changes.items():
            key = PARAM_TO_KEY[pname]
            fspan = _field_block_span(src, sign_start, sign_end, key)
            if fspan is None:
                continue
            fstart, fend = fspan
            block = src[fstart:fend]
            inner_pat = re.compile(r"minConfidence\s*:\s*[0-9.]+")
            if inner_pat.search(block):
                new_block = inner_pat.sub(f"minConfidence: {rec['recommended']}", block)
            elif block.strip():
                new_block = block.rstrip().rstrip(",") + f", minConfidence: {rec['recommended']}"
            else:
                new_block = f"minConfidence: {rec['recommended']}"
            if new_block != block:
                src = src[:fstart] + new_block + src[fend:]
                # field block length may have changed; recompute sign_end for subsequent fields
                sign_end += len(new_block) - len(block)
                any_change = True
        if any_change:
            touched_signs.append(sign_name)

    TS_SIGNS_PATH.write_text(src, encoding="utf-8")
    return touched_signs


if __name__ == "__main__":
    touched = apply_recommendations()
    print(f"Updated signs in {TS_SIGNS_PATH.relative_to(ROOT)}: {touched}")
