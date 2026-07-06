"""Phase 6 — Human-in-the-loop calibration as the quality gate.

This deterministic pipeline has no loss function and no backpropagation; the equivalent of ML
"training" is a rigorous calibration pass tracked like a deployment checklist. Two gates guard every
sign before its avatar clip may ship (per the procedural-avatar report):

  1. Verifier gate (automated, here): the SAME schema that animates the sign must also recognize it.
     `self_verify()` synthesizes the sign, replays it through `core.verifier` (must PASS), and — for
     any sign that requires movement — also replays a STATIC freeze of it (must FAIL). That static
     check is the synthesis-side guard against the original single-frame bug: a sign whose avatar is
     subtly wrong in BOTH directions (e.g. APPLE animated at the nose instead of the cheek) is caught
     because the recognition side, built from the same schema, would refuse to confirm it.

  2. Human gate (manual): a fluent/Deaf signer reviews the rendered clip and flips `avatar_reviewed`
     / `avatar_approved`, leaving calibration notes. Corrections are made by editing schema
     parameters, never by hand-tuning IK — then the clip is regenerated.

A clip is shippable only when verifier_passed AND avatar_approved. The log persists to JSON so the
calibration state of every vocabulary item is auditable, exactly the table the report prescribes.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from core.schema import Sign
from core.synthesis import Body, synthesize
from core.verifier import verify

DEFAULT_LOG_PATH = Path(__file__).resolve().parent.parent / "calibration_log.json"


# --------------------------------------------------------------------------- automated gate
@dataclass
class SelfVerifyResult:
    """Outcome of replaying a synthesized sign through the recognition verifier (both directions)."""

    sign_name: str
    proper_passed: bool                 # animated sign is recognized
    confusor_rejected: bool             # frozen sign is rejected (N/A -> True for static signs)
    movement_required: bool
    scores: dict = field(default_factory=dict)
    failing_required: list = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.proper_passed and self.confusor_rejected

    def summary(self) -> str:
        if self.passed:
            extra = "static confusor rejected" if self.movement_required else "static sign"
            return f"PASS  ({extra})"
        why = []
        if not self.proper_passed:
            why.append(f"animated clip failed {self.failing_required}")
        if not self.confusor_rejected:
            why.append("frozen confusor leaked through (movement not enforced!)")
        return "FAIL  " + "; ".join(why)


def self_verify(sign: Sign, body: Body | None = None) -> SelfVerifyResult:
    """Run the automated bilateral gate for one sign."""
    proper = verify(synthesize(sign, body=body).buffer(), sign)
    mv_required = sign.movement.required
    if mv_required:
        static = verify(synthesize(sign, static=True, body=body).buffer(), sign)
        confusor_rejected = not static.passed
    else:
        confusor_rejected = True        # no movement to enforce; nothing to leak
    return SelfVerifyResult(
        sign_name=sign.name,
        proper_passed=proper.passed,
        confusor_rejected=confusor_rejected,
        movement_required=mv_required,
        scores={p.name: round(p.score, 3) for p in proper.params},
        failing_required=proper.failing_required,
    )


# --------------------------------------------------------------------------- tracking log
@dataclass
class CalibrationRecord:
    """One vocabulary item's lifecycle through the calibration checklist (the report's table row)."""

    sign_id: str
    verifier_passed: bool = False
    avatar_reviewed: bool = False
    avatar_approved: bool = False
    notes: str = ""

    @property
    def shippable(self) -> bool:
        """A clip ships only with both the automated and human gates green."""
        return self.verifier_passed and self.avatar_approved


class CalibrationLog:
    """A persisted map of sign_id -> CalibrationRecord; the auditable calibration database."""

    def __init__(self, path: Path | str = DEFAULT_LOG_PATH):
        self.path = Path(path)
        self.records: dict[str, CalibrationRecord] = {}

    # ---- persistence ----
    def load(self) -> "CalibrationLog":
        if self.path.exists():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.records = {k: CalibrationRecord(**v) for k, v in data.items()}
        return self

    def save(self) -> "CalibrationLog":
        self.path.write_text(
            json.dumps({k: asdict(v) for k, v in self.records.items()}, indent=2),
            encoding="utf-8",
        )
        return self

    # ---- mutations ----
    def get(self, sign_id: str) -> CalibrationRecord:
        return self.records.setdefault(sign_id, CalibrationRecord(sign_id=sign_id))

    def record_self_verify(self, sign: Sign, body: Body | None = None) -> SelfVerifyResult:
        """Run the automated gate and write its result into the sign's verifier_passed flag."""
        res = self_verify(sign, body=body)
        rec = self.get(sign.name)
        rec.verifier_passed = res.passed
        if not res.passed:
            rec.notes = (rec.notes + " | " if rec.notes else "") + res.summary()
        return res

    def mark_reviewed(self, sign_id: str, approved: bool, notes: str = "") -> CalibrationRecord:
        """Record a human reviewer's verdict on the rendered avatar clip."""
        rec = self.get(sign_id)
        rec.avatar_reviewed = True
        rec.avatar_approved = approved
        if notes:
            rec.notes = notes
        return rec

    # ---- queries ----
    def shippable_ids(self) -> list[str]:
        return [k for k, r in self.records.items() if r.shippable]

    def assert_shippable(self, sign_id: str) -> None:
        """Guard a release: raise unless both gates are green for this sign."""
        rec = self.get(sign_id)
        if not rec.shippable:
            raise RuntimeError(
                f"{sign_id} is not shippable: verifier_passed={rec.verifier_passed}, "
                f"avatar_approved={rec.avatar_approved}. {rec.notes}".strip()
            )

    def table(self) -> str:
        """Render the calibration checklist as the report's tracking table."""
        head = f"{'Sign':12} {'Verifier':8} {'Reviewed':8} {'Approved':8} Notes"
        rows = [head, "-" * len(head)]
        for k in sorted(self.records):
            r = self.records[k]
            rows.append(
                f"{k:12} {_yn(r.verifier_passed):8} {_yn(r.avatar_reviewed):8} "
                f"{_yn(r.avatar_approved):8} {r.notes}"
            )
        return "\n".join(rows)


def _yn(b: bool) -> str:
    return "Y" if b else "N"
