import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards the two ways component code drifts off the design system. Both are drift that a reviewer
 * cannot reasonably catch by eye, which is why they are mechanical.
 *
 * History: DESIGN.md recorded the brand gradient as having been consolidated into one utility on
 * 2026-07-11. By 2026-07-27 there were 20 hardcoded `linear-gradient(...)` values across 15 files
 * again. Because they were literal hex they were all theme-blind — `StreakCard` hardcoded
 * `#18103A`, the DARK theme's `z-card`, so the streak card stayed near-black while every other
 * card turned light lavender in the light theme. A prose rule in a doc did not hold; this does.
 */

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const FILES = tsxFiles(SRC).map((path) => ({
  path,
  rel: path.slice(SRC.length + 1).replace(/\\/g, '/'),
  source: readFileSync(path, 'utf8'),
}));

describe('design token discipline', () => {
  /**
   * A gradient written with literal hex cannot follow the theme. Components must use a
   * `bg-gradient-*` / `text-gradient-*` utility, or build the gradient from `var(--color-z-*)`.
   *
   * Data-driven gradients (a world's or unit's own identity colour, interpolated from
   * `data/worlds.ts` / `data/lessons.ts`) are legitimate and use a template literal, so they carry
   * no literal hex here and pass.
   */
  it('no component builds a gradient from literal hex', () => {
    const offenders = FILES.flatMap(({ rel, source }) =>
      source
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => /linear-gradient\([^)]*#[0-9A-Fa-f]{3,8}/.test(line))
        .map(({ line, n }) => `${rel}:${n}  ${line.slice(0, 90)}`)
    );

    expect(
      offenders,
      `Hardcoded hex in a gradient — these cannot follow the theme.\n` +
        `Use a bg-gradient-* utility from index.css, or var(--color-z-*) stops.\n` +
        offenders.join('\n')
    ).toEqual([]);
  });

  /**
   * Tailwind silently drops a class it does not recognise, so a typo'd `bg-gradient-*` renders as
   * a transparent card rather than an error — and the white text on it becomes invisible. This
   * catches the typo at test time instead.
   */
  it('every bg-gradient-* / text-gradient-* class used in a component is defined in index.css', () => {
    const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');
    const defined = new Set(
      [...css.matchAll(/@utility\s+((?:bg|text)-gradient-[\w-]+)\s*\{/g)].map((m) => m[1])
    );

    // Tailwind ships its own directional `bg-gradient-to-{t,tr,r,br,b,bl,l,tl}`; those are the
    // framework's, not ours, and are paired with from-/via-/to- colour classes rather than an
    // @utility. Only project-namespaced gradient classes are checked here.
    const TAILWIND_DIRECTIONAL = /^bg-gradient-to-(t|tr|r|br|b|bl|l|tl)$/;

    const missing = FILES.flatMap(({ rel, source }) =>
      [...source.matchAll(/\b((?:bg|text)-gradient-[\w-]+)\b/g)]
        .map((m) => m[1])
        .filter((cls) => !defined.has(cls) && !TAILWIND_DIRECTIONAL.test(cls))
        .map((cls) => `${rel}: ${cls}`)
    );

    expect(
      [...new Set(missing)],
      `Used but not defined as an @utility in index.css:\n${[...new Set(missing)].join('\n')}\n` +
        `Defined: ${[...defined].join(', ')}`
    ).toEqual([]);
  });
});

/**
 * Overlays on the camera / clip surfaces. These are the only places in the app where the
 * background is unknown at build time — it is whatever the learner's room looks like — so the
 * usual "check it against the theme token" reasoning does not apply and the rules have to be
 * enforced on the markup instead.
 *
 * Both rules below encode the same root mistake, which every one of the seven 2026-07-27 failures
 * shared: assuming the video would be dark. It is dark in the developer's room.
 */
describe('overlays on live video', () => {
  // Every component that draws chrome on top of a <video> or the mirrored canvas.
  const VIDEO_SURFACES = [
    'components/shared/WebcamMirror.tsx',
    'components/shared/RemotePeerVideo.tsx',
    'components/shared/TurnOverlay.tsx',
    'components/lesson/ReferenceClip.tsx',
    'components/lesson/ClipEnlarge.tsx',
  ];

  /** Source with comments removed — these files explain the old bad values in prose, and a naive
   *  scan would flag the explanation as the defect. */
  function markup(rel: string): string {
    const file = FILES.find((f) => f.rel === rel);
    if (!file) throw new Error(`${rel} not found — was it moved? Update VIDEO_SURFACES.`);
    return file.source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('uses bg-video-plate, never a hand-rolled bg-black/NN backing', () => {
    // A full-screen modal backdrop is `fixed inset-0` and dims the PAGE, not the video — it has no
    // text on it and no contrast requirement, so it is not part of this rule. An over-video plate
    // is positioned inside the frame. The distinction is the positioning, which is why it is
    // matched here rather than left to a per-file exception list that would rot.
    const offenders = VIDEO_SURFACES.flatMap((rel) =>
      markup(rel)
        .split('\n')
        .filter((line) => !/fixed inset-0/.test(line))
        .flatMap((line) => [...line.matchAll(/bg-black\/\d+/g)].map((m) => `${rel}: ${m[0]}`))
    );
    expect(
      offenders,
      `Hand-rolled black plates on a video surface:\n${offenders.join('\n')}\n` +
        `Use bg-video-plate. Its alpha is derived from the worst case (a blown-out frame) and is ` +
        `covered by tokenContrast.test.ts; a local bg-black/NN is a guess that drifts.`
    ).toEqual([]);
  });

  it('never drops white text below /85 on a video surface', () => {
    const offenders = VIDEO_SURFACES.flatMap((rel) =>
      [...markup(rel).matchAll(/text-white\/(\d+)/g)]
        .filter((m) => Number(m[1]) < 85)
        .map((m) => `${rel}: ${m[0]}`)
    );
    expect(
      offenders,
      `Text this faint is not readable against a bright camera frame:\n${offenders.join('\n')}\n` +
        `white/85 on bg-video-plate is 5.03:1 against any frame; white/70 is 4.0:1 and fails. ` +
        `WebcamMirror's hand labels were unplated white/60 — 1.00:1, invisible.`
    ).toEqual([]);
  });
});

/**
 * Modal dialogs. A dialog needs four things a plain `<div>` does not get for free: `role="dialog"`
 * + `aria-modal` so a screen reader announces it, focus moved inside on open, focus trapped while
 * open, and Escape to dismiss. `useDialogA11y` supplies all four; `ModalShell` wraps it.
 *
 * Why a test (regression, 2026-07-28): ModalShell had this behaviour from the 2026-07-12 audit, but
 * adoption stopped at the four auth modals it was extracted from. Of eleven dialogs in the app,
 * EIGHT had no dialog semantics whatsoever — a keyboard user could tab straight through them into
 * the page behind, and nothing announced that a dialog had opened. Three more had the aria
 * attributes but no focus trap. axe cannot catch this: it has no way to know that a given div was
 * meant to be a dialog, so the whole class was invisible to the automated sweep in e2e/a11y.spec.ts.
 *
 * The heuristic is `fixed inset-0`. Every full-viewport overlay in this app is a dialog, so the
 * rule holds with no exemption list — and an exemption list is precisely where a real dialog would
 * eventually get parked. If a genuine non-dialog full-screen overlay is ever added (a splash
 * screen, say), that is the moment to reconsider the heuristic rather than to add an exception.
 */
describe('modal dialogs', () => {
  it('every full-screen overlay routes through useDialogA11y or ModalShell', () => {
    const missing = FILES.filter(
      ({ source }) =>
        /fixed inset-0/.test(source) &&
        !/useDialogA11y|ModalShell/.test(source)
    ).map(({ rel }) => rel);

    expect(
      missing,
      `These render a full-screen overlay without dialog accessibility:\n${missing.join('\n')}\n` +
        `Call useDialogA11y({ label, onClose }) and spread its props onto the dialog element, or ` +
        `wrap the content in ModalShell. Pass \`active\` too if the component stays mounted and ` +
        `gates its own content on an \`open\` flag, or the trap arms while the dialog is closed.`
    ).toEqual([]);
  });
});
