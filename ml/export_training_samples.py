#!/usr/bin/env python3
"""
Drain the Supabase `training_samples` table to a local JSONL file, then delete the exported rows.

WHY: landmark frames are stored as jsonb in Postgres (~32 KB/row). The Supabase free tier caps
the database at 500 MB, so this table must be periodically moved off-DB — both to keep the app's
writes working AND because the landmarks belong on your laptop for ML training anyway. Run this
every few days (more often during a traffic spike).

SAFETY: exports EVERY row first, verifies the on-disk count matches what was read, and only then
deletes exactly the IDs it exported. Rows inserted while the export runs keep a higher id and are
NOT deleted — they get picked up by the next run. Nothing is deleted that wasn't saved.

training_samples has owner-only RLS, so reading every user's rows requires the project SECRET key
(sb_secret_..., the service-role replacement) — NOT the publishable/anon key. That key bypasses
RLS, so keep it OUT of the repo and the app: pass it via the environment only.

USAGE (PowerShell):
    $env:SUPABASE_URL        = "https://juzqilqilxzmudazltjx.supabase.co"
    $env:SUPABASE_SECRET_KEY = "sb_secret_...."   # a CURRENT secret key from the dashboard
    python ml/export_training_samples.py                 # export + delete
    python ml/export_training_samples.py --dry-run       # export only, delete nothing

Output goes to ml/training_exports/training_samples_<UTC timestamp>.jsonl (gitignored).
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import request, parse, error

PAGE = 500  # rows per REST request

def _endpoint() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SECRET_KEY environment variables first (see the "
                 "module docstring). The secret key must be a current sb_secret_... value.")
    return url.rstrip("/"), key

def _req(method: str, path: str, key: str, body: bytes | None = None, extra_headers: dict | None = None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = request.Request(method=method, url=path, data=body, headers=headers)
    try:
        with request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {path}: {e.read().decode(errors='replace')}")

def export_rows(base: str, key: str, out_path: Path) -> list[int]:
    """Stream every row to disk in id order. Returns the list of exported ids."""
    ids: list[int] = []
    offset = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        while True:
            q = parse.urlencode({"select": "*", "order": "id.asc", "limit": PAGE, "offset": offset})
            url = f"{base}/rest/v1/training_samples?{q}"
            _, raw, _ = _req("GET", url, key)
            batch = json.loads(raw)
            if not batch:
                break
            for row in batch:
                f.write(json.dumps(row, separators=(",", ":")) + "\n")
                ids.append(row["id"])
            offset += len(batch)
            print(f"  exported {offset} rows…", end="\r")
            if len(batch) < PAGE:
                break
    print(f"  exported {len(ids)} rows total          ")
    return ids

def verify(out_path: Path, expected: int) -> None:
    with out_path.open("r", encoding="utf-8") as f:
        on_disk = sum(1 for _ in f)
    if on_disk != expected:
        sys.exit(f"ABORT: wrote {on_disk} lines but exported {expected} rows — NOT deleting anything.")
    print(f"  verified {on_disk} lines on disk == {expected} exported")

def delete_ids(base: str, key: str, ids: list[int]) -> None:
    """Delete only the ids we exported, in chunks, so concurrent inserts are never touched."""
    deleted = 0
    for i in range(0, len(ids), PAGE):
        chunk = ids[i:i + PAGE]
        id_list = ",".join(str(x) for x in chunk)
        url = f"{base}/rest/v1/training_samples?id=in.({id_list})"
        _req("DELETE", url, key, extra_headers={"Prefer": "return=minimal"})
        deleted += len(chunk)
        print(f"  deleted {deleted}/{len(ids)}…", end="\r")
    print(f"  deleted {deleted} rows                   ")

def main() -> None:
    ap = argparse.ArgumentParser(description="Export + delete training_samples from Supabase.")
    ap.add_argument("--dry-run", action="store_true", help="Export only; delete nothing.")
    args = ap.parse_args()

    base, key = _endpoint()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = Path(__file__).parent / "training_exports" / f"training_samples_{stamp}.jsonl"

    print(f"Exporting training_samples -> {out_path}")
    ids = export_rows(base, key, out_path)
    if not ids:
        print("Nothing to export. Done.")
        return
    verify(out_path, len(ids))

    if args.dry_run:
        print("Dry run: kept all rows in the database. Saved file is ready for training.")
        return

    print("Deleting exported rows from the database…")
    delete_ids(base, key, ids)
    print(f"Done. {len(ids)} rows are now only on your laptop at {out_path}")

if __name__ == "__main__":
    main()
