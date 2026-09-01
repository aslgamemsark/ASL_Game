import { describe, expect, it } from 'vitest';

const modules = import.meta.glob('/src/{hooks/useRecognition.ts,pages/{LessonPage,PracticePage,StoryPage,SpeedChallengePage}.tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('camera quality announcement', () => {
  it('exposes one shared debounced quality issue to every solo signing screen', () => {
    expect(modules['/src/hooks/useRecognition.ts']).toContain('qualityAnnouncement');
    for (const [path, source] of Object.entries(modules).filter(([path]) => path.includes('/pages/'))) {
      expect(source, path).toContain('recognition.qualityAnnouncement');
    }
  });
});
