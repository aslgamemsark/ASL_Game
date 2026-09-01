import { describe, expect, it } from 'vitest';

const pages = import.meta.glob('/src/pages/{LessonPage,StoryPage,SpeedChallengePage}.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('solo camera recovery', () => {
  it('offers the shared camera-free practice route from every camera-driven solo screen', () => {
    for (const page of Object.values(pages)) {
      expect(page).toContain('Practice without camera');
      expect(page).toContain('onPracticeWithoutCamera');
    }
  });
});
