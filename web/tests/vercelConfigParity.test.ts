import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guards against `headers`/`rewrites` drifting apart between the two `vercel.json` files.
 *
 * `web/vercel.json` is what the canonical Vercel project (Root Directory = `web`) actually reads
 * and serves from — it is the one place the app's real CSP/HSTS/Permissions-Policy headers live.
 * The root `vercel.json` (added 2026-08-30, see its own file for why) exists ONLY so a Vercel
 * project rooted at the repo root — a plausible cause of the `asl_game1` project's build failures —
 * builds the web app correctly instead of Vercel's zero-config detection tripping over the root
 * `requirements.txt` and treating this as a Python project. It is genuinely inert for the canonical
 * project (Vercel resolves `vercel.json` inside the project's Root Directory, so a `web`-rooted
 * project never sees the root file at all — confirmed by this repo's own history: a root
 * `vercel.json` with different CSP values coexisted with `web/vercel.json` for ~4 weeks in July
 * 2026 with zero effect on production, see the commit that removed it).
 *
 * But if a root-rooted project DOES exist, it serves whatever `headers`/`rewrites` the root file
 * says — and this repo already has a documented history of exactly this kind of two-file drift
 * (`web/public/robots.txt`'s own header comment: "both files need the same new-page entry", about
 * robots.txt and vercel.json's CSP staying in sync for new marketing pages). Silently shipping a
 * public origin with a stale or missing CSP/Permissions-Policy — on a camera-using app — is a real
 * security regression, not a cosmetic one. This test converts that drift risk into a red test
 * instead of a silent divergence.
 */
describe('vercel.json parity (root vs web)', () => {
  const root = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'));
  const web = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8'));

  it('headers are byte-identical', () => {
    expect(root.headers).toEqual(web.headers);
  });

  it('rewrites are byte-identical', () => {
    expect(root.rewrites).toEqual(web.rewrites);
  });

  it('root config explicitly opts out of framework auto-detection', () => {
    // Not "vite" — there is no vite.config at the repo root, and letting Vercel guess invites
    // exactly the misdetection (Python, via the root requirements.txt) this file exists to prevent.
    expect(root.framework).toBeNull();
  });

  it('root config explicitly overrides the install step', () => {
    // The load-bearing line: an unset installCommand lets Vercel's zero-config detection run
    // `pip install -r requirements.txt` at the repo root before ever reaching a build command.
    expect(root.installCommand).toBeTruthy();
    expect(root.installCommand).toMatch(/web/);
  });

  it('root config builds and outputs from web/', () => {
    expect(root.buildCommand).toMatch(/web/);
    expect(root.outputDirectory).toBe('web/dist');
  });
});
