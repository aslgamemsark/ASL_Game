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
