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
/** WCAG 1.4.11 (Non-text Contrast) — UI components like a focus indicator need only 3:1, not the
 *  4.5:1 required for text. */
const AA_NON_TEXT = 3.0;

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

/**
 * The `bg-gradient-*` utilities are saturated surfaces that white text sits on. Each one must
 * carry that text at AA on its LIGHTEST stop — the lightest stop is the worst case, and on a
 * 135° gradient it is the bottom-right corner, which is exactly where a card's secondary line
 * tends to land.
 *
 * Why this is a test and not a comment (regression, 2026-07-27): the scrim used to be a separate
 * `<div className="absolute inset-0 bg-black/NN" />` at each call site, hand-tuned once against
 * one gradient and then copied. The values drifted to /20, /30, /45 and /50, and three cards had
 * no scrim at all. `bg-gradient-primary` — every primary button in the app — ended on
 * `z-purple-light`, putting white bold label text at 2.72:1 in the dark theme. None of that is
 * visible by reading a component; it only shows up when you multiply the stop by the scrim.
 *
 * Adding a gradient utility: add it here with the weakest text it must carry. If it never has
 * text on it (a progress-bar fill, a glow), leave it out and say so — `bg-gradient-urgent`, the
 * Speed timer bar, is the only current example.
 */
const GRADIENT_SURFACES: { utility: string; minWhiteAlpha: number; note: string }[] = [
  // Buttons. Deliberately unscrimmed (a scrim reads as muddy at button size), so the floor is
  // full white — hierarchy on these comes from weight and size, never from a dimmer label.
  { utility: 'bg-gradient-primary', minWhiteAlpha: 1, note: 'primary CTA buttons' },
  // Scrimmed card surfaces: heading `text-white`, secondary line `text-white/80`.
  { utility: 'bg-gradient-teal', minWhiteAlpha: 0.8, note: 'quiz / warm-up cards' },
  { utility: 'bg-gradient-blue', minWhiteAlpha: 0.8, note: 'Speed Challenge entry + sprint tier' },
  { utility: 'bg-gradient-violet', minWhiteAlpha: 0.8, note: 'practice entry cards + blitz tier' },
  { utility: 'bg-gradient-amber', minWhiteAlpha: 0.8, note: 'Shop purchase buttons' },
  { utility: 'bg-gradient-ember', minWhiteAlpha: 0.8, note: 'weak-signs card' },
  { utility: 'bg-gradient-streak', minWhiteAlpha: 0.8, note: 'streak card' },
  // Unscrimmed by design — it is the one COLD surface in the family, already dark enough that a
  // scrim would crush it to flat black. It still carries text, so it still gets checked.
  { utility: 'bg-gradient-locked', minWhiteAlpha: 0.8, note: 'locked / coming-soon world card' },
];

/** Composite `white` at `alpha` over an opaque background. */
function whiteOver(alpha: number, bg: string): string {
  const channels = [1, 3, 5]
    .map((i) => parseInt(bg.slice(i, i + 2), 16))
    .map((c) => Math.round(255 * alpha + c * (1 - alpha)));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Darken an opaque colour by a black scrim of the given alpha. */
function scrimmed(hex: string, alpha: number): string {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16))
    .map((c) => Math.round(c * (1 - alpha)));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** The utility's declaration block, straight out of the stylesheet. */
function utilityBody(name: string): string {
  const at = CSS.indexOf(`@utility ${name} {`);
  if (at === -1) throw new Error(`index.css has no "@utility ${name}"`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

describe.each([
  ['dark', ':root,\n.dark'],
  ['light', '.light {'],
])('%s theme gradient surfaces', (themeName, selector) => {
  const tokens = themeTokens(selector);

  for (const { utility, minWhiteAlpha, note } of GRADIENT_SURFACES) {
    it(`${utility} carries white/${minWhiteAlpha * 100} at AA (${note})`, () => {
      const body = utilityBody(utility);

      // A baked-in scrim is the first background layer: linear-gradient(rgb(0 0 0 / A), same).
      const scrimAlpha = Number(body.match(/rgb\(0 0 0 \/ ([\d.]+)\)/)?.[1] ?? 0);

      // Colour stops are either literal hex or var(--color-z-NAME); resolve the latter per theme.
      const stops = [...body.matchAll(/#[0-9A-Fa-f]{6}|var\(--color-(z-[\w-]+)\)/g)]
        .map((m) => (m[1] ? tokens[m[1]] : m[0]))
        .filter(Boolean);
      expect(stops.length, `could not parse colour stops out of "${utility}"`).toBeGreaterThan(0);

      // Lightest stop = worst case for white text.
      const lightest = stops.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
      const surface = scrimmed(lightest, scrimAlpha);
      const ratio = contrastRatio(whiteOver(minWhiteAlpha, surface), surface);

      expect(
        Number(ratio.toFixed(2)),
        `${utility}: white/${minWhiteAlpha * 100} on its lightest stop (${lightest} under a ` +
          `${scrimAlpha * 100}% scrim = ${surface}) is ${ratio.toFixed(2)}:1 in the ${themeName} ` +
          `theme — below AA. Deepen the scrim or darken the stop; do not fix this at the call ` +
          `site with a one-off text colour, which is how the family drifted apart before.`
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }
});

/**
 * Text over LIVE VIDEO. The webcam mirror and the reference clips are the only surfaces whose
 * background is genuinely unknown — it is the learner's room. Neither theme's tokens help, because
 * the video does not follow the theme, so the only honest floor is the worst case: every overlay
 * must clear AA against a blown-out WHITE frame and against a BLACK one.
 *
 * Regression, 2026-07-27. Seven overlays failed, and the pattern in each was the same mistake —
 * assuming the video would be dark:
 *   - ReferenceClip's sign name sat at the transparent end of a `to-t from-black/60` fade: 1.41:1.
 *     The most important label on the surface had the least backing behind it.
 *   - WebcamMirror's hand-zone labels were unplated `text-white/60`: 1.00:1 on a bright frame.
 *   - The camera guide's SUCCESS chip was `bg-z-green/90` + white — white on a light green,
 *     1.82:1 — so the one message confirming correct framing was the least readable thing on it.
 */
describe('text over live video', () => {
  const WHITE_FRAME = '#FFFFFF';
  const BLACK_FRAME = '#000000';

  /** Composite `hex` at `alpha` over an opaque background. */
  function composite(hex: string, alpha: number, bg: string): string {
    const mix = [1, 3, 5].map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha))
    );
    return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  const plateAlpha = Number(
    CSS.slice(CSS.indexOf('@utility bg-video-plate {'))
      .match(/rgb\(0 0 0 \/ ([\d.]+)\)/)?.[1]
  );

  it('bg-video-plate is defined with a parseable alpha', () => {
    expect(plateAlpha, 'could not read the alpha out of @utility bg-video-plate').toBeGreaterThan(0);
  });

  // white/85 is the documented floor for body text on this plate; white/70 does NOT clear it.
  for (const textAlpha of [1, 0.85]) {
    for (const frame of [WHITE_FRAME, BLACK_FRAME]) {
      it(`white/${textAlpha * 100} on bg-video-plate clears AA over a ${frame === WHITE_FRAME ? 'blown-out' : 'dark'} frame`, () => {
        const plate = composite('#000000', plateAlpha, frame);
        const ratio = contrastRatio(composite('#FFFFFF', textAlpha, plate), plate);
        expect(
          Number(ratio.toFixed(2)),
          `white/${textAlpha * 100} over bg-video-plate (${plateAlpha}) on a ${frame} frame is ` +
            `${ratio.toFixed(2)}:1 — below AA. Raise the plate alpha in index.css; do not fix this ` +
            `by assuming the camera feed is dark, because it is whatever room the learner is in.`
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }
  }

  /**
   * The selected-hand ✓ badge. `bg-z-green` + `text-z-bg` works in both themes *because* the two
   * tokens invert in opposite directions — light ink on a light-green fill in the dark theme, dark
   * ink on a dark-green fill in the light theme. `bg-z-green text-white` was 1.92:1 in the dark
   * theme, which is what this pair replaced. Both halves must keep inverting for it to hold.
   */
  describe.each([
    ['dark', ':root,\n.dark'],
    ['light', '.light {'],
  ])('%s theme', (themeName, selector) => {
    const tokens = themeTokens(selector);

    it('the success badge (bg-z-green + text-z-bg) clears AA', () => {
      const ratio = contrastRatio(tokens['z-bg'], tokens['z-green']);
      expect(
        Number(ratio.toFixed(2)),
        `text-z-bg (${tokens['z-bg']}) on bg-z-green (${tokens['z-green']}) is ${ratio.toFixed(2)}:1 ` +
          `in the ${themeName} theme. This pair only works while z-bg and z-green invert in ` +
          `OPPOSITE directions between themes — check that before changing either.`
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('the turn-indicator chip (bg-z-purple + white) clears AA', () => {
      const ratio = contrastRatio('#FFFFFF', tokens['z-purple']);
      expect(Number(ratio.toFixed(2)), `white on bg-z-purple is ${ratio.toFixed(2)}:1 in ${themeName}`)
        .toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});

/**
 * The global `:focus-visible` ring (regression, 2026-07-30): it was a hardcoded `#A78BFA` — the
 * DARK theme's z-purple-light value — so every keyboard focus ring in the LIGHT theme was
 * 2.04:1 against z-bg, well under the 3:1 WCAG 1.4.11 needs for a UI indicator. Nothing caught it
 * because `e2e/a11y.spec.ts` disables axe's color-contrast rule (still does — it flags the
 * intentional gradient wordmark as a false positive) and this file had no case for the ring
 * itself, only for text tokens. Now reads the real token (`var(--color-z-purple-light)` in
 * index.css) rather than a second hardcoded copy, so it can't drift from what ships.
 */
describe.each([
  ['dark', ':root,\n.dark'],
  ['light', '.light {'],
])('%s theme focus ring', (themeName, selector) => {
  const tokens = themeTokens(selector);

  it('focus-visible ring (z-purple-light) clears 3:1 against z-bg', () => {
    const ratio = contrastRatio(tokens['z-purple-light'], tokens['z-bg']);
    expect(
      Number(ratio.toFixed(2)),
      `z-purple-light (${tokens['z-purple-light']}) on z-bg (${tokens['z-bg']}) is ` +
        `${ratio.toFixed(2)}:1 in the ${themeName} theme — below the 3:1 WCAG 1.4.11 needs for ` +
        `a focus indicator.`
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
