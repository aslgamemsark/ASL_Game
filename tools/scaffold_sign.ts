/**
 * Scaffolding helper for adding a new sign to the rule-based recognition engine.
 *
 * This does NOT add a sign at runtime — per CLAUDE.md's non-negotiable rule, every sign's
 * handshape/location/movement thresholds need real tuning against actual camera footage, which
 * an admin-panel form cannot safely do. What this script DOES do is remove the boilerplate: it
 * prints a starter `createSign()` block for `web/src/engine/signs/index.ts`, a starter `SignDef`
 * entry for `web/src/data/signs.ts`, and writes a confusor-test stub under `web/tests/` — all with
 * TODOs marking the values that need real tuning. A developer reviews, tunes against live capture
 * (see tools/live_calibrate.py), and commits normally.
 *
 * Usage:
 *   npx tsx tools/scaffold_sign.ts --name LOVE --handshape open --location chest --movement circular
 *   npx tsx tools/scaffold_sign.ts --name MOTHER --handshape open5 --location chin --movement none --two-handed --nondominant-handshape open5
 *
 * --location one of: neutral_space | chest | chin | forehead | belly | shoulder | other_hand
 * --movement one of: none | linear | circular | repeated | converge | traced
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const VALID_LOCATIONS = ['neutral_space', 'chest', 'chin', 'forehead', 'belly', 'shoulder', 'other_hand'];
const VALID_MOVEMENTS = ['none', 'linear', 'circular', 'repeated', 'converge', 'traced'];

const ANCHOR_ENUM: Record<string, string> = {
  neutral_space: 'NEUTRAL_SPACE',
  chest: 'CHEST',
  chin: 'CHIN',
  forehead: 'FOREHEAD',
  belly: 'BELLY',
  shoulder: 'SHOULDER',
  other_hand: 'OTHER_HAND',
};

const MOVEMENT_ENUM: Record<string, string> = {
  none: 'NONE',
  linear: 'LINEAR',
  circular: 'CIRCULAR',
  repeated: 'REPEATED',
  converge: 'CONVERGE',
  traced: 'TRACED',
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const rawName = args.name;
  if (typeof rawName !== 'string' || !rawName.trim()) fail('--name is required, e.g. --name LOVE');
  const name = rawName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  const handshape = typeof args.handshape === 'string' ? args.handshape : fail('--handshape is required (e.g. open, flat, s, claw, 1, v, ...)');

  const location = typeof args.location === 'string' ? args.location.toLowerCase() : 'neutral_space';
  if (!VALID_LOCATIONS.includes(location)) {
    fail(`--location must be one of: ${VALID_LOCATIONS.join(', ')} (got "${location}")`);
  }

  const movement = typeof args.movement === 'string' ? args.movement.toLowerCase() : 'none';
  if (!VALID_MOVEMENTS.includes(movement)) {
    fail(`--movement must be one of: ${VALID_MOVEMENTS.join(', ')} (got "${movement}")`);
  }

  const twoHanded = Boolean(args['two-handed']);
  const nondominantHandshape = typeof args['nondominant-handshape'] === 'string' ? args['nondominant-handshape'] : null;
  if (twoHanded && !nondominantHandshape) {
    fail('--two-handed requires --nondominant-handshape (createSign() throws otherwise)');
  }

  const anchor = ANCHOR_ENUM[location];
  const movementKind = MOVEMENT_ENUM[movement];
  const hasMotion = movement !== 'none';

  // ── 1. engine/signs/index.ts block ──────────────────────────────────────────
  const movementBlock = hasMotion
    ? `  movement: { kind: MovementKind.${movementKind}, actor: DOMINANT, minDurationS: 0.6 /* TODO: tune */, required: true, minConfidence: 0.4 /* TODO: tune */ },`
    : `  movement: { kind: MovementKind.NONE, required: false },`;

  const engineBlock = `export const ${name} = createSign({
  name: '${name}', twoHanded: ${twoHanded},
  dominant: { kind: '${handshape}', required: true }, // TODO: verify against core/handshape_presets.py naming
  location: { anchor: Anchor.${anchor}, actingHand: DOMINANT, maxDistRatio: 1.0 /* TODO: tune */, required: true },
${movementBlock}${nondominantHandshape ? `\n  nondominant: { kind: '${nondominantHandshape}', required: true },` : ''}
});`;

  // ── 2. data/signs.ts entry (UI/reference-video metadata) ────────────────────
  const dataBlock = `  ${name}: {
    name: '${name}',
    description: 'TODO: plain-English description of the sign',
    hint: 'TODO: short coaching hint shown during practice',
    // clip: '/clips/${name}.mp4', // TODO: add only once a real reference video exists
  },`;

  // ── 3. confusor test stub ────────────────────────────────────────────────────
  const testFileName = `${name.toLowerCase().replace(/_/g, '-')}.test.ts`;
  const testPath = join('web', 'tests', testFileName);
  const testStub = `/**
 * Confusor regression test for ${name} — TODO before merging:
 *   1. Import ${name} from the engine and build two landmark fixtures with the shared helpers
 *      in web/tests/letters.test.ts (makeHand/staticBuffer) or web/tools/record_fixture.py for a
 *      real capture-derived fixture.
 *   2. "correct" fixture must pass verify(); "confusor" fixture (the likeliest accidental
 *      false-positive sign) must NOT pass — per CLAUDE.md, a movement sign must never pass on a
 *      single static frame, so the confusor fixture should specifically be the static/no-motion
 *      version of this sign if movement is required.
 */
import { describe, it, expect } from 'vitest';
import { verify, resultPassed } from '../src/engine/verifier';
import { RollingBuffer } from '../src/engine/landmarks';
import { ${name} } from '../src/engine/signs';

describe('${name} confusor', () => {
  it.todo('correct ${name} passes verify()');
  it.todo('closest confusor does NOT pass verify()');
});
`;

  console.log('\n// ---- paste into web/src/engine/signs/index.ts (and add to a *_SIGNS array!) ----\n');
  console.log(engineBlock);
  console.log('\n// ---- paste into the SIGNS record in web/src/data/signs.ts ----\n');
  console.log(dataBlock);

  if (existsSync(testPath)) {
    console.log(`\n(skipped writing ${testPath} — already exists)`);
  } else {
    writeFileSync(testPath, testStub, 'utf-8');
    console.log(`\nwrote confusor-test stub: ${testPath}`);
  }

  console.log(`
Next steps:
  1. Paste the two blocks above, tune the TODO values against real capture (tools/live_calibrate.py).
  2. Add ${name} to the right *_SIGNS array (COFFEE_SIGNS / HOSPITAL_SIGNS / CLASSROOM_SIGNS, or a new one).
  3. Fill in ${testPath} and run: npx vitest run ${testFileName}
  4. Only add a "clip:" reference once a real StudioGalt/hand-authored/DeepMotion video exists —
     never point it at a placeholder.
`);
}

main();
