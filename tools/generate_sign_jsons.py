#!/usr/bin/env python3
"""Generate sign JSON files from Python sign definitions.

This script reads the Python sign definitions (signs/*.py) and outputs
JSON files conforming to sign.schema.json. This is the single source of truth
for sign definitions — both Python and TypeScript engines consume these JSON files.

Usage:
    python tools/generate_sign_jsons.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# Add project root to path so we can import core.schema
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.schema import Anchor, MovementKind, PalmFacing, Sign  # noqa: E402

# Import all sign definitions
from signs import (  # noqa: E402
    BREATHE,
    COFFEE,
    DIZZY,
    DOCTOR,
    EMERGENCY,
    FEVER,
    FRIEND,
    HELLO,
    HELP,
    HOSPITAL,
    LETTER_A,
    LETTER_B,
    LETTER_C,
    LETTER_D,
    LETTER_E,
    LETTER_F,
    LETTER_G,
    LETTER_H,
    LETTER_I,
    LETTER_J,
    LETTER_K,
    LETTER_L,
    LETTER_M,
    LETTER_N,
    LETTER_O,
    LETTER_P,
    LETTER_Q,
    LETTER_R,
    LETTER_S,
    LETTER_T,
    LETTER_U,
    LETTER_V,
    LETTER_W,
    LETTER_X,
    LETTER_Y,
    LETTER_Z,
    MEDICINE,
    MORE,
    NAME,
    NURSE,
    PAIN,
    PLEASE,
    READ,
    RED,
    SICK,
    TEACHER,
    TEAM,
    THANK_YOU,
    WANT,
    WATER,
    WIN,
    WRITE,
    YELLOW,
    YES,
    YOU,
)

ALL_SIGNS: list[Sign] = [
    HELLO, PLEASE, THANK_YOU, YOU,
    COFFEE, WANT, MORE, YES,
    LETTER_A, LETTER_B, LETTER_C, LETTER_D, LETTER_E, LETTER_F,
    LETTER_G, LETTER_H, LETTER_I, LETTER_J, LETTER_K, LETTER_L,
    LETTER_M, LETTER_N, LETTER_O, LETTER_P, LETTER_Q, LETTER_R,
    LETTER_S, LETTER_T, LETTER_U, LETTER_V, LETTER_W, LETTER_X,
    LETTER_Y, LETTER_Z,
    HELP, PAIN, MEDICINE, EMERGENCY, FEVER, WATER, DIZZY, SICK,
    DOCTOR, NURSE, BREATHE, HOSPITAL,
    TEACHER, WRITE, READ, NAME, FRIEND,
    RED, YELLOW, WIN, TEAM,
]

# Map enums to their string values for JSON
ANCHOR_MAP = {
    Anchor.OTHER_HAND: "other_hand",
    Anchor.NEUTRAL_SPACE: "neutral_space",
    Anchor.CHEST: "chest",
    Anchor.CHIN: "chin",
    Anchor.FOREHEAD: "forehead",
    Anchor.BELLY: "belly",
    Anchor.SHOULDER: "shoulder",
}

MOVEMENT_KIND_MAP = {
    MovementKind.NONE: "none",
    MovementKind.LINEAR: "linear",
    MovementKind.CIRCULAR: "circular",
    MovementKind.REPEATED: "repeated",
    MovementKind.CONVERGE: "converge",
    MovementKind.TRACED: "traced",
}

PALM_FACING_MAP = {
    PalmFacing.IN: "in",
    PalmFacing.OUT: "out",
    PalmFacing.UP: "up",
    PalmFacing.DOWN: "down",
    PalmFacing.LEFT: "left",
    PalmFacing.RIGHT: "right",
}

DOMINANT = "dominant"
NONDOMINANT = "nondominant"


def handshape_to_json(hs) -> dict[str, Any]:
    return {
        "kind": hs.kind,
        "required": hs.required,
        "minConfidence": hs.min_confidence,
    }


def location_to_json(loc) -> dict[str, Any]:
    return {
        "anchor": ANCHOR_MAP[loc.anchor],
        "actingHand": DOMINANT if loc.acting_hand == DOMINANT else NONDOMINANT,
        "maxDistRatio": loc.max_dist_ratio,
        "minDistRatio": loc.min_dist_ratio,
        "vertical": loc.vertical,
        "below": loc.below,
        "useClosestApproach": loc.use_closest_approach,
        "required": loc.required,
        "minConfidence": loc.min_confidence,
    }


def movement_to_json(mov) -> dict[str, Any]:
    return {
        "kind": MOVEMENT_KIND_MAP[mov.kind],
        "actor": DOMINANT if mov.actor == DOMINANT else NONDOMINANT,
        "pivot": DOMINANT if mov.pivot == DOMINANT else NONDOMINANT,
        "minTotalRotationDeg": mov.min_total_rotation_deg,
        "radiusToleranceRatio": mov.radius_tolerance_ratio,
        "direction": list(mov.direction) if mov.direction else None,
        "minDisplacementRatio": mov.min_displacement_ratio,
        "minCycles": mov.min_cycles,
        "minAmplitudeRatio": mov.min_amplitude_ratio,
        "minApproachRatio": mov.min_approach_ratio,
        "traceTemplate": list(mov.trace_template) if mov.trace_template else [],
        "traceToleranceDeg": mov.trace_tolerance_deg,
        "gateToLocation": mov.gate_to_location,
        "otherHandMaxMotionRatio": mov.other_hand_max_motion_ratio,
        "minDurationS": mov.min_duration_s,
        "required": mov.required,
        "minConfidence": mov.min_confidence,
    }


def orientation_to_json(ori) -> dict[str, Any] | None:
    if ori is None:
        return None
    return {
        "hand": DOMINANT if ori.hand == DOMINANT else NONDOMINANT,
        "facing": PALM_FACING_MAP[ori.facing],
        "required": ori.required,
        "minConfidence": ori.min_confidence,
    }


def nmm_to_json(nmm) -> dict[str, Any] | None:
    if nmm is None:
        return None
    return {
        "blendshape": nmm.blendshape,
        "minScore": nmm.min_score,
        "required": nmm.required,
        "minConfidence": nmm.min_confidence,
    }


def sign_to_json(sign: Sign) -> dict[str, Any]:
    return {
        "name": sign.name,
        "twoHanded": sign.two_handed,
        "extraHandMotionFloor": sign.extra_hand_motion_floor,
        "dominant": handshape_to_json(sign.dominant),
        "nondominant": handshape_to_json(sign.nondominant) if sign.nondominant else None,
        "location": location_to_json(sign.location),
        "movement": movement_to_json(sign.movement),
        "orientation": orientation_to_json(sign.orientation),
        "nmm": nmm_to_json(sign.nmm),
    }


def main():
    output_dir = Path(__file__).parent.parent / "signs"
    output_dir.mkdir(exist_ok=True)

    for sign in ALL_SIGNS:
        json_data = sign_to_json(sign)
        output_path = output_dir / f"{sign.name.lower()}.json"
        with open(output_path, "w") as f:
            json.dump(json_data, f, indent=2)
        print(f"Generated {output_path.name}")

    print(f"\nDone: {len(ALL_SIGNS)} sign JSON files generated in {output_dir}")


if __name__ == "__main__":
    main()