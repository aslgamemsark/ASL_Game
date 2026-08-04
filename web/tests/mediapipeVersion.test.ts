import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MEDIAPIPE_WASM_VERSION } from '../src/engine/capture';

// Read the manifest off disk rather than `require`ing it: the package's `exports` map does not
// expose the './package.json' subpath, so module resolution refuses it.
const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/@mediapipe/tasks-vision/package.json',
);

/**
 * The MediaPipe JS wrapper (npm) and the WASM binary it drives (CDN) must be the same version.
 *
 * capture.ts pins the CDN URL to a hardcoded version string while package.json carries a caret
 * range, so a routine `npm install` can move the installed wrapper forward and leave the WASM
 * pointer behind. The result is not a build error or a crash — it is the two halves of the
 * recognition runtime disagreeing, which surfaces as intermittent, hard-to-reproduce landmark
 * behaviour. That is the worst possible failure mode for this app, and the only thing standing
 * between it and production was a comment asking the next person to remember.
 */
describe('MediaPipe WASM pin', () => {
  it('matches the installed @mediapipe/tasks-vision version', () => {
    const installed = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string }).version;
    expect(
      MEDIAPIPE_WASM_VERSION,
      `capture.ts pins the WASM bundle to ${MEDIAPIPE_WASM_VERSION} but @mediapipe/tasks-vision ` +
      `resolves to ${installed}. Update MEDIAPIPE_WASM_VERSION in src/engine/capture.ts to match — ` +
      'the JS API and the WASM binary it drives must be the same version.'
    ).toBe(installed);
  });
});
