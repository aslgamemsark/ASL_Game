import { afterEach, describe, expect, it } from 'vitest';
import { soundEffects } from '../soundEffects';

describe('soundEffects', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('does not block an interaction when AudioContext cannot start', () => {
    (globalThis as { window: unknown }).window = {
      AudioContext: class {
        constructor() {
          throw new Error('audio blocked');
        }
      },
    };

    expect(() => soundEffects.tap()).not.toThrow();
  });
});
