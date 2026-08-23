import { describe, it, expect } from 'vitest';
import { SIGNS } from '@/data/signs';
import { SIGNS as ENGINE_SIGNS } from '@/engine/signs/index';

/**
 * Sign-registry consistency locks (90+ shipping round).
 *
 * data/signs.ts is TEACHING copy; engine/signs is RECOGNITION truth, generated from Python
 * core/signs (the source of truth). Pages pass ENGINE_SIGNS[id] to useRecognition, so
 * display↔engine semantic drift cannot silently change verification — but drift DOES produce
 * contradictory coaching (display says "hand at forehead", checklist gates nothing), and any
 * future consumer of display semantics would inherit stale thresholds. This suite pins:
 *
 *  1. Every displayed sign is recognizable.
 *  2. Required-ness agrees per parameter between display and engine.
 *  3. Engine-only signs are exactly the known intentional set (pipeline-complete, not yet
 *     taught) — so a FUTURE orphan surfaces as a test failure instead of silent dead content.
 */

/** Engine-only signs that are deliberately registered but not yet in any lesson/UI. */
const KNOWN_ENGINE_ONLY = ['RED', 'YELLOW', 'WIN', 'TEAM'] as const;

const DISPLAY_IDS = Object.keys(SIGNS);
const ENGINE_IDS = Object.keys(ENGINE_SIGNS);

describe('sign registry consistency', () => {
  it('every displayed sign has an engine definition', () => {
    for (const id of DISPLAY_IDS) {
      expect(ENGINE_SIGNS[id], `SIGNS.${id} has no engine definition — unreachable by recognition`).toBeTruthy();
    }
  });

  it('required-ness agrees per parameter between display and engine', () => {
    const drift: string[] = [];
    for (const id of DISPLAY_IDS) {
      const d = SIGNS[id];
      const e = ENGINE_SIGNS[id]!;
      if (d.dominant.required !== e.dominant.required) {
        drift.push(`${id}.dominant.required: display=${d.dominant.required} engine=${e.dominant.required}`);
      }
      if (d.location.required !== e.location.required) {
        drift.push(`${id}.location.required: display=${d.location.required} engine=${e.location.required}`);
      }
      if (d.movement.required !== e.movement.required) {
        drift.push(`${id}.movement.required: display=${d.movement.required} engine=${e.movement.required}`);
      }
    }
    expect(
      drift,
      `display↔engine drift — the ENGINE mirrors Python core/signs (source of truth); fix the DISPLAY side:\n${drift.join('\n')}`
    ).toEqual([]);
  });

  it('engine-only signs are exactly the known intentional set', () => {
    const orphans = ENGINE_IDS.filter((id) => !SIGNS[id]).sort();
    expect(orphans.sort()).toEqual([...KNOWN_ENGINE_ONLY].sort());
  });
});
