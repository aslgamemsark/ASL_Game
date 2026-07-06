"""B3 (data-driven exemplar calibration) — replaces "wait for B0" with real ASL Citizen/WLASL data.

Instead of asking Saad to hand-record confusor fixtures for every sign, this replays REAL
recorded productions (already extracted to data/asl_citizen/landmarks and data/wlasl/landmarks —
see ml/dataset.py for the same source) through the existing core/verifier.py scorers and reports,
per sign per parameter:

  - the score distribution real, correctly-labeled signers actually achieve (catches thresholds
    set too strict -> false-fails on legitimate variation)
  - for known confusable pairs (ml/train.py CONFUSABLE_PAIRS), the score the CONFUSOR sign's real
    clips get when run through the target sign's verifier (catches thresholds set too loose ->
    false-passes on a different, visually-similar sign)

Output is a report (JSON + printed table); --apply writes recommended min_confidence values back
into signs/*.py, but ONLY where real data supports the change and it doesn't create a known
false-pass regression against a confusor. This is a calibration tool, not a classifier: it never
changes which geometric quantity is measured, only the pass/fail threshold on the existing score.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np

from core.landmarks import Frame, RollingBuffer
from core.verifier import ParamScore, verify
from signs import SIGNS

ROOT = Path(__file__).resolve().parent.parent
DATASET_ROOTS = {
    "asl_citizen": ROOT / "data" / "asl_citizen" / "landmarks",
    "wlasl": ROOT / "data" / "wlasl" / "landmarks",
}
MANIFESTS = {
    "asl_citizen": ROOT / "data" / "asl_citizen" / "manifest.csv",
    "wlasl": ROOT / "data" / "wlasl" / "manifest.csv",
}

# Confusor pairs from ml/train.py CONFUSABLE_PAIRS, filtered to signs we actually have both
# real landmark clips for AND a rule-based Sign definition (letters/FEVER/SORRY have neither).
CONFUSABLE_PAIRS = [
    ("DOCTOR", "NURSE"),
    ("COFFEE", "YES"),
    ("MEDICINE", "DOCTOR"),
]

MIN_HAND_COVERAGE = 0.30   # below this the extraction itself is too noisy to trust
MIN_CLIPS_TO_CALIBRATE = 5  # don't touch a threshold on fewer than this many real samples


def _load_manifest_coverage() -> dict[str, float]:
    """clip_id -> hand_coverage, across both manifests."""
    coverage: dict[str, float] = {}
    for path in MANIFESTS.values():
        if not path.exists():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        header = lines[0].split(",")
        idx_clip, idx_cov = header.index("clip_id"), header.index("hand_coverage")
        for line in lines[1:]:
            parts = line.split(",")
            if len(parts) <= max(idx_clip, idx_cov):
                continue
            clip_id = parts[idx_clip]
            try:
                coverage[clip_id] = float(parts[idx_cov])
            except ValueError:
                continue
    return coverage


def _clip_paths_for_sign(sign_name: str, coverage: dict[str, float]) -> list[Path]:
    paths: list[Path] = []
    for dataset, root in DATASET_ROOTS.items():
        d = root / sign_name
        if not d.exists():
            continue
        for f in sorted(d.glob("*.json")):
            clip_id = f"{sign_name}/{f.stem}"
            cov = coverage.get(clip_id)
            if cov is not None and cov < MIN_HAND_COVERAGE:
                continue
            paths.append(f)
    return paths


def _replay_max_scores(clip_path: Path, sign_def) -> dict[str, float] | None:
    """Feed one real clip through the buffer incrementally; return the BEST (max) score per
    parameter seen at any point in the clip — the most favorable read a real signer's own
    production gets, matching how the live loop only needs one good window to pass."""
    data = json.loads(clip_path.read_text(encoding="utf-8"))
    frames = [Frame.from_dict(fd) for fd in data["frames"]]
    if len(frames) < 4:
        return None

    buf = RollingBuffer(window_seconds=2.0)
    best: dict[str, float] = {}
    for f in frames:
        buf.add(f)
        if buf.duration < 0.8:   # mirror MIN_FRAMES_BEFORE_PASS's intent: need a real window first
            continue
        result = verify(buf, sign_def)
        for p in result.params:
            best[p.name] = max(best.get(p.name, 0.0), p.score)
    return best or None


def _percentile(vals: list[float], pct: float) -> float:
    return float(np.percentile(np.array(vals), pct)) if vals else 0.0


def collect_stats(sign_names: list[str], coverage: dict[str, float]) -> dict:
    """For every sign: real-clip per-parameter score distributions (+ confusor distributions
    where a confusable pair exists and both sides have data)."""
    stats: dict[str, dict] = {}

    for name in sign_names:
        sign_def = SIGNS[name]
        clip_paths = _clip_paths_for_sign(name, coverage)
        per_param: dict[str, list[float]] = {}
        n_used = 0
        for cp in clip_paths:
            scores = _replay_max_scores(cp, sign_def)
            if scores is None:
                continue
            n_used += 1
            for pname, val in scores.items():
                per_param.setdefault(pname, []).append(val)
        stats[name] = {
            "n_clips": len(clip_paths),
            "n_used": n_used,
            "own_scores": per_param,
            "confusor_scores": {},   # filled below
        }

    for target, confusor in CONFUSABLE_PAIRS:
        if target not in SIGNS or confusor not in SIGNS:
            continue
        confusor_clips = _clip_paths_for_sign(confusor, coverage)
        if not confusor_clips:
            continue
        target_def = SIGNS[target]
        per_param: dict[str, list[float]] = {}
        for cp in confusor_clips:
            scores = _replay_max_scores(cp, target_def)
            if scores is None:
                continue
            for pname, val in scores.items():
                per_param.setdefault(pname, []).append(val)
        if target in stats:
            stats[target]["confusor_scores"][confusor] = per_param

    return stats


def recommend(stats: dict) -> dict:
    """Per sign, per parameter: recommended min_confidence + reasoning, given real data."""
    recs: dict[str, dict] = {}
    for name, s in stats.items():
        sign_def = SIGNS[name]
        param_reqs = {
            "handshape_dominant": sign_def.dominant,
            "handshape_nondominant": sign_def.nondominant,
            "location": sign_def.location,
            "movement": sign_def.movement,
            "orientation": sign_def.orientation,
            "nmm": sign_def.nmm,
        }
        sign_recs = {}
        for pname, own_vals in s["own_scores"].items():
            req = param_reqs.get(pname)
            if req is None or s["n_used"] < MIN_CLIPS_TO_CALIBRATE:
                continue
            current = req.min_confidence
            # Floor a real correct signer needs to clear: p10 of real productions, minus a small
            # margin so we don't shave the exact boundary. This is the false-fail guard.
            real_floor = max(0.25, _percentile(own_vals, 10) - 0.05)

            confusor_vals: list[float] = []
            for _confusor_name, cparams in s["confusor_scores"].items():
                confusor_vals.extend(cparams.get(pname, []))
            # Ceiling a confusor sign reaches on THIS parameter: p90 of confusor attempts, plus a
            # margin. Only set when a real CONFUSABLE_PAIR with actual clips exists.
            confusor_ceiling = _percentile(confusor_vals, 90) + 0.05 if confusor_vals else None

            if confusor_ceiling is not None and real_floor <= confusor_ceiling:
                sign_recs[pname] = {
                    "current": current, "recommended": current,
                    "status": "CONFLICT",
                    "note": (f"real correct clips only clear {real_floor:.2f} at their worst 10%, "
                             f"but confusor clips reach {confusor_ceiling:.2f} on this parameter "
                             f"alone — no single threshold separates them; needs a feature-level "
                             f"fix, not a number change."),
                }
                continue

            # LOOSEN is justified purely from real correct-clip data: if the worst ~10% of real,
            # correctly-labeled signers score below the current threshold, that threshold is
            # rejecting genuine production and needs to come down — a direct false-fail fix,
            # independent of any confusor evidence.
            #
            # TIGHTEN is a different, riskier claim: dataset clips are clean, single-take,
            # professionally-signed footage — a real signer's own good moment there does NOT mean
            # a noisier live webcam user reliably clears the same bar. Only tighten when a real
            # CONFUSABLE_PAIR's actual clips prove the CURRENT threshold already lets the confusor
            # through (confusor_ceiling >= current) — i.e. tightening fixes a demonstrated
            # false-pass, never a hypothetical one from "correct signers can hit 1.0" alone.
            if confusor_ceiling is not None and confusor_ceiling >= current:
                recommended = float(np.clip(min(confusor_ceiling, real_floor), 0.25, 0.9))
            elif real_floor < current:
                recommended = float(np.clip(real_floor, 0.25, 0.9))
            else:
                recommended = current

            if recommended < current - 0.03:
                status = "LOOSEN"
            elif recommended > current + 0.03:
                status = "TIGHTEN"
            else:
                status = "NO_CHANGE"
            sign_recs[pname] = {
                "current": current, "recommended": round(recommended, 2), "status": status,
                "note": (f"real n={s['n_used']} clips, p10={_percentile(own_vals,10):.2f} "
                         f"median={_percentile(own_vals,50):.2f}"
                         + (f", confusor p90={confusor_ceiling - 0.05:.2f}" if confusor_ceiling else "")),
            }
        recs[name] = sign_recs
    return recs


def _find_call_span(src: str, kw: str) -> tuple[int, int] | None:
    """Find the byte span of the `<kw>=SomeClass(...)` call's parenthesized argument list,
    matched by paren depth (not regex) so it's correct even when the call spans many lines or
    has no min_confidence kwarg at all yet."""
    m = re.search(rf"\b{kw}\s*=\s*\w+\(", src)
    if not m:
        return None
    start = m.end()  # just after the opening '('
    depth = 1
    i = start
    while i < len(src) and depth > 0:
        if src[i] == "(":
            depth += 1
        elif src[i] == ")":
            depth -= 1
        i += 1
    return start, i - 1  # i-1 is the index of the matching ')'


def apply_changes(recs: dict) -> list[str]:
    """Patch (or insert) min_confidence= in signs/<name>.py for LOOSEN/TIGHTEN recs.

    Many signs never set min_confidence explicitly (they rely on the schema dataclass default of
    0.6/0.5) — a plain regex replace silently no-ops on those, so this locates the call's argument
    list by paren-matching and either replaces an existing min_confidence=<num> inside it or
    inserts one as an added kwarg. Returns files touched.
    """
    param_to_kw = {
        "handshape_dominant": "dominant",
        "handshape_nondominant": "nondominant",
        "location": "location",
        "movement": "movement",
        "orientation": "orientation",
        "nmm": "nmm",
    }
    touched = []
    for sign_name, sign_recs in recs.items():
        changes = {p: r for p, r in sign_recs.items() if r["status"] in ("LOOSEN", "TIGHTEN")}
        if not changes:
            continue
        path = ROOT / "signs" / f"{sign_name.lower()}.py"
        if not path.exists():
            continue
        src = path.read_text(encoding="utf-8")
        new_src = src
        for pname, rec in changes.items():
            kw = param_to_kw[pname]
            span = _find_call_span(new_src, kw)
            if span is None:
                continue
            start, end = span
            block = new_src[start:end]
            inner_pat = re.compile(r"min_confidence\s*=\s*[0-9.]+")
            if inner_pat.search(block):
                new_block = inner_pat.sub(f"min_confidence={rec['recommended']}", block)
            elif block.strip():
                new_block = block.rstrip().rstrip(",") + f", min_confidence={rec['recommended']}"
            else:
                new_block = f"min_confidence={rec['recommended']}"
            new_src = new_src[:start] + new_block + new_src[end:]
        if new_src != src:
            path.write_text(new_src, encoding="utf-8")
            touched.append(str(path.relative_to(ROOT)))
    return touched


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write recommended thresholds into signs/*.py")
    ap.add_argument("--out", default="tools/calibration_report.json")
    args = ap.parse_args()

    coverage = _load_manifest_coverage()
    available_signs = sorted(
        n for n in SIGNS
        if any((root / n).exists() for root in DATASET_ROOTS.values())
    )
    print(f"Signs with real dataset clips: {available_signs}")

    stats = collect_stats(available_signs, coverage)
    recs = recommend(stats)

    print("\n%-14s %-22s %8s %8s %6s  %s" % ("SIGN", "PARAM", "CURRENT", "REC", "N", "STATUS"))
    for sign_name, sign_recs in recs.items():
        for pname, rec in sign_recs.items():
            print("%-14s %-22s %8.2f %8.2f %6s  %s\n    %s" % (
                sign_name, pname, rec["current"], rec["recommended"],
                stats[sign_name]["n_used"], rec["status"], rec["note"],
            ))

    out_path = ROOT / args.out
    out_path.write_text(json.dumps({"stats_n_used": {k: v["n_used"] for k, v in stats.items()},
                                     "recommendations": recs}, indent=2), encoding="utf-8")
    print(f"\nFull report written to {out_path}")

    if args.apply:
        touched = apply_changes(recs)
        print(f"\nApplied changes to: {touched}" if touched else "\nNo changes applied (nothing to loosen/tighten).")


if __name__ == "__main__":
    main()
