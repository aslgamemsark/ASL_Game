import { SIGNS } from './signs';

/**
 * Curated "everyday basics" word signs shown in the Basic Signs tab — a hand-picked starter set
 * rather than derived from SIGNS (which has no category field to filter by).
 */
export const BASIC_SIGN_IDS = ['HELLO', 'THANK_YOU', 'PLEASE', 'YOU', 'NAME'];

// Fails loudly at import time if this curated list ever drifts from signs.ts (a rename or
// removal there), rather than silently rendering an empty tile in the tab.
for (const id of BASIC_SIGN_IDS) {
  if (!SIGNS[id]) {
    throw new Error(`BASIC_SIGN_IDS references unknown sign '${id}' — check web/src/data/signs.ts`);
  }
}
