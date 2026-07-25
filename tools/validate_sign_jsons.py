#!/usr/bin/env python3
"""Validate generated sign JSON files against schema."""

import json
import sys
from pathlib import Path

try:
    import jsonschema
except ImportError:
    print("Installing jsonschema...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "jsonschema"])
    import jsonschema

SCHEMA_PATH = Path(__file__).parent.parent / "signs" / "sign.schema.json"
SIGNS_DIR = Path(__file__).parent.parent / "signs"


def main():
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)

    validator = jsonschema.Draft202012Validator(schema)

    errors = 0
    for json_file in sorted(SIGNS_DIR.glob("*.json")):
        if json_file.name == "sign.schema.json":
            continue
        with open(json_file) as f:
            data = json.load(f)
        try:
            validator.validate(data)
            print(f"✓ {json_file.name}")
        except jsonschema.ValidationError as e:
            print(f"✗ {json_file.name}: {e.message}")
            errors += 1

    if errors:
        print(f"\n{errors} validation errors")
        sys.exit(1)
    else:
        print(f"\nAll {len(list(SIGNS_DIR.glob('*.json'))) - 1} sign JSON files valid")


if __name__ == "__main__":
    main()