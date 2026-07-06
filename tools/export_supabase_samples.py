"""D.4 — Export collected web-app attempts back into the training pipeline.

Pulls rows from the `training_samples` table (web/src/hooks/useProgressSync.ts::logAttempt,
gated by the user's `collect_training_data` opt-out — see supabase/schema.sql) and writes them
out as Frame-format JSON, identical in shape to what `tools/extract_dataset.py` produces, so the
collected data merges straight into `ml/dataset.py` with zero format conversion:

    data/collected/<SIGN>/<sample_id>.json   # {"sign_name": ..., "frames": [...]}
    data/collected/manifest.csv              # clip_id, sign, signer_id, split

Then retrain with both sources, e.g.:
    python -m ml.dataset --landmarks data/landmarks data/wlasl/landmarks data/collected \
                          --manifest data/manifest.csv data/wlasl/manifest.csv data/collected/manifest.csv \
                          --out data/cache_merged.npz

Requires the Supabase SERVICE ROLE key (bypasses RLS to read every user's rows) — this key must
NEVER ship in the web client. Run this locally only:

    SUPABASE_URL=https://xxxx.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY=eyJ... \
    python -m tools.export_supabase_samples

Resumable: tracks the highest exported row id in data/collected/.export_state.json and only
fetches newer rows on the next run. The web app's `Frame` type is camelCase
(leftShoulder/rightShoulder); this script converts to the snake_case shape `core/landmarks.py`
and the rest of the Python pipeline expect (left_shoulder/right_shoulder).
"""
from __future__ import annotations

import csv
import json
import os
import random
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

PAGE_SIZE = 500
SPLIT_RATIOS = (0.70, 0.15, 0.15)
SPLIT_SEED = 42


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise SystemExit(f"missing required env var {name} (service-role key only — never commit it)")
    return val


def _fetch_page(base_url: str, service_key: str, after_id: int) -> list[dict]:
    url = (
        f"{base_url}/rest/v1/training_samples"
        f"?select=id,user_id,sign_id,frames,rule_passed,ai_prediction,ai_confidence,final_passed,source"
        f"&id=gt.{after_id}&order=id.asc&limit={PAGE_SIZE}"
    )
    req = urllib.request.Request(url, headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Supabase fetch failed ({exc.code}): {body}") from exc


def _to_python_frame(js_frame: dict) -> dict:
    """camelCase web Frame -> snake_case core.landmarks.Frame.to_dict() shape."""
    return {
        "t": js_frame.get("t"),
        "width": js_frame.get("width"),
        "height": js_frame.get("height"),
        "hands": js_frame.get("hands", []),
        "left_shoulder": js_frame.get("leftShoulder"),
        "right_shoulder": js_frame.get("rightShoulder"),
        "mouth": js_frame.get("mouth"),
    }


def _load_state(state_path: Path) -> int:
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8")).get("last_id", 0)
    return 0


def _save_state(state_path: Path, last_id: int) -> None:
    state_path.write_text(json.dumps({"last_id": last_id}), encoding="utf-8")


def _split_by_signer(signer_ids: list[str], seed: int = SPLIT_SEED,
                     ratios=SPLIT_RATIOS) -> dict[str, str]:
    """Same whole-signer split logic as tools/extract_dataset.py::_split_by_signer — keeps
    signer-disjoint discipline when this data is merged with ASL Citizen / WLASL."""
    signers = sorted(set(signer_ids))
    rng = random.Random(seed)
    rng.shuffle(signers)
    n = len(signers)
    n_train = int(n * ratios[0])
    n_val = int(n * ratios[1])
    out: dict[str, str] = {}
    for i, s in enumerate(signers):
        out[s] = "train" if i < n_train else "val" if i < n_train + n_val else "test"
    return out


def export(out_dir: str = "data/collected", min_frames: int = 10) -> None:
    base_url = _env("SUPABASE_URL").rstrip("/")
    service_key = _env("SUPABASE_SERVICE_ROLE_KEY")

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    state_path = out_path / ".export_state.json"
    manifest_path = out_path / "manifest.csv"

    last_id = _load_state(state_path)
    new_rows: list[dict] = []
    while True:
        page = _fetch_page(base_url, service_key, last_id)
        if not page:
            break
        new_rows.extend(page)
        last_id = page[-1]["id"]
        if len(page) < PAGE_SIZE:
            break

    if not new_rows:
        print("export: no new training_samples rows since last run")
        return

    skipped_short = 0
    written: list[dict] = []
    for row in new_rows:
        frames = row.get("frames") or []
        if len(frames) < min_frames:
            skipped_short += 1
            continue
        sign = row["sign_id"]
        sample_id = row["id"]
        signer = row["user_id"]

        py_frames = [_to_python_frame(f) for f in frames]
        payload = {"sign_name": sign, "frames": py_frames}

        sign_dir = out_path / sign
        sign_dir.mkdir(parents=True, exist_ok=True)
        clip_stem = f"sample_{sample_id}"
        (sign_dir / f"{clip_stem}.json").write_text(json.dumps(payload), encoding="utf-8")

        written.append({
            "clip_id": f"{sign}/{clip_stem}",
            "sign": sign,
            "signer_id": signer,
            "n_frames": len(frames),
            "rule_passed": row.get("rule_passed"),
            "ai_prediction": row.get("ai_prediction"),
            "final_passed": row.get("final_passed"),
            "source": row.get("source"),
        })

    if not written:
        print(f"export: fetched {len(new_rows)} rows, all skipped (< {min_frames} frames)")
        _save_state(state_path, last_id)
        return

    # Re-derive the signer split over ALL signers seen so far (existing manifest rows + new),
    # so re-running this script never reshuffles an already-assigned signer across splits.
    existing_signers: list[str] = []
    if manifest_path.exists():
        with open(manifest_path, newline="", encoding="utf-8") as fh:
            existing_signers = [r["signer_id"] for r in csv.DictReader(fh)]
    all_signers = existing_signers + [w["signer_id"] for w in written]
    split_map = _split_by_signer(all_signers)

    file_exists = manifest_path.exists()
    with open(manifest_path, "a", newline="", encoding="utf-8") as fh:
        cols = ["clip_id", "sign", "signer_id", "split", "n_frames",
                "rule_passed", "ai_prediction", "final_passed", "source"]
        w = csv.DictWriter(fh, fieldnames=cols)
        if not file_exists:
            w.writeheader()
        for row in written:
            w.writerow({**row, "split": split_map[row["signer_id"]]})

    _save_state(state_path, last_id)
    print(f"export -> {out_path} ({len(written)} new clips, {skipped_short} skipped as too short)")
    print(f"manifest -> {manifest_path}")


if __name__ == "__main__":
    export()
