import { describe, it, expect } from 'vitest';
import { buildShareUrl } from '@/components/shared/ShareButton';

// The interactive half of ShareButton (navigator.share / clipboard, React rendering) isn't unit-
// tested — this repo has no .tsx component tests at all (interactive UI is covered by Playwright
// e2e instead, see e2e/), and LessonPage's completion screen specifically needs a real camera pass
// to reach, which the current e2e suite can't do (no fake video device — see playwright.config.ts).
// buildShareUrl is the one piece of real logic that's both pure and load-bearing (a wrong URL here
// means every share silently loses attribution), so it's what gets covered.
describe('buildShareUrl', () => {
  it('points at the marketing root, not /app — a share recipient is a cold visitor', () => {
    const url = buildShareUrl('https://quicksignn.vercel.app', 'first_lesson_complete');
    expect(new URL(url).pathname).toBe('/');
  });

  it('carries share/referral UTMs so attribution.ts attributes the click', () => {
    const url = buildShareUrl('https://quicksignn.vercel.app', 'first_lesson_complete');
    const params = new URL(url).searchParams;
    expect(params.get('utm_source')).toBe('share');
    expect(params.get('utm_medium')).toBe('referral');
    expect(params.get('utm_campaign')).toBe('first_lesson_share');
  });

  it('respects the passed-in origin rather than hardcoding one', () => {
    const url = buildShareUrl('http://localhost:4173', 'first_lesson_complete');
    expect(url.startsWith('http://localhost:4173/')).toBe(true);
  });
});
