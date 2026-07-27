import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Every colour token that is used as TEXT must clear WCAG AA (4.5:1) against every surface token
 * it can land on, in BOTH themes.
 *
 * Why this test exists (regression, 2026-07-27): the dark theme had been contrast-audited and was
 * clean, but the light theme shipped without one — 26 token/surface pairs were below AA, including
 * the three colours that carry the product's core feedback vocabulary. `z-yellow` (XP) sat at
 * 1.41:1 on a card, `z-orange` (streak) at 2.24:1, `z-green` (sign passed) at 3.13:1. A learner in
 * light mode effectively could not read whether they had just succeeded.
 *
 * The mechanism was that light values were chosen by hue-matching their dark counterparts rather
 * than by re-deriving them for an inverted background, and nothing mechanical caught it — contrast
 * in a theme you don't personally use is invisible to manual review. So the check is mechanical:
 * it parses the real `@theme` runtime variables out of index.css, so it cannot drift from what
 * ships, and it fails with the exact ratio rather than a bare boolean.
 *
 * Adding a token: if it is ever rendered as text, add it to TEXT_TOKENS. If it is only ever a
 * fill behind other content, leave it out — a decorative bar has no contrast requirement, and
 * listing it here would force a pointless darkening.
 */

const AA_NORMAL_TEXT = 4.5;

// Lives in tests/ rather than src/ so the app's `tsc -b` build never type-checks it: it reads the
// filesystem, and node: builtins aren't in the app tsconfig's types (see .claude/rules/file-placement.md).
const CSS = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');

/** Surfaces that app text actually sits on, per DESIGN.md's card/surface conventions. */
const SURFACE_TOKENS = ['z-bg', 'z-card', 'z-surface'] as const;

/** Tokens used with `text-*` anywhere in the app. */
const TEXT_TOKENS = [
  'z-gray-50', 'z-gray-100', 'z-gray-200', 'z-gray-300', 'z-gray-400',
  'z-purple-light', 'z-purple-glow',
  'z-green', 'z-red', 'z-blue', 'z-teal', 'z-teal-light', 'z-yellow', 'z-orange',
] as const;

/**
 * Pull one theme's `--rt-*` hex values out of the stylesheet.
 *
 * Reads the shipped CSS rather than a duplicated table of colours on purpose: a second copy of the
 * palette would be one more thing to forget to update, which is the same class of mistake this
 * test exists to catch.
 */
function themeTokens(selector: string): Record<string, string> {
  const at = CSS.indexOf(selector);
  if (at === -1) throw new Error(`index.css has no "${selector}" block — did the theme selectors change?`);
  const body = CSS.slice(CSS.indexOf('{', at), CSS.indexOf('}', at));
  const tokens: Record<string, string> = {};
  for (const [, name, hex] of body.matchAll(/--rt-([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens[name] = hex;
  }
  return tokens;
}

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['dark', ':root,\n.dark'],
  ['light', '.light {'],
])('%s theme text tokens', (themeName, selector) => {
  const tokens = themeTokens(selector);

  for (const fg of TEXT_TOKENS) {
    for (const bg of SURFACE_TOKENS) {
      it(`${fg} on ${bg} clears AA`, () => {
        const [fgHex, bgHex] = [tokens[fg], tokens[bg]];
        expect(fgHex, `${themeName} theme is missing --rt-${fg}`).toBeDefined();
        expect(bgHex, `${themeName} theme is missing --rt-${bg}`).toBeDefined();

        const ratio = contrastRatio(fgHex, bgHex);
        expect(
          Number(ratio.toFixed(2)),
          `${fg} (${fgHex}) on ${bg} (${bgHex}) is ${ratio.toFixed(2)}:1 — below AA. ` +
            `Lower the token's OKLCH lightness (light theme) or raise it (dark theme); ` +
            `do not lighten the surface, which would flatten the card/page separation.`
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }
  }
});
