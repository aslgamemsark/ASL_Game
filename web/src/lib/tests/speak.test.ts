import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { speakSign } from '../speak';
import { useSettingsStore } from '@/stores/useSettingsStore';

// No jsdom in this project (Playwright already covers every page across three device
// projects — see docs/PRODUCT_BACKLOG_SAAD.md's declined-items list). Tests run in Node, which
// has no `window` global at all, so `window` is stubbed directly on `globalThis` per test rather
// than pulling in a DOM environment for one function.
function stubWindow(speechSynthesis: Pick<SpeechSynthesis, 'speak' | 'cancel'>) {
  (globalThis as unknown as { window: unknown }).window = { speechSynthesis };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    class { constructor(public text: string) {} };
}

describe('speakSign', () => {
  beforeEach(() => {
    useSettingsStore.setState({ speechEnabled: true });
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
  });

  it('speaks the sign name when speech is enabled', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    stubWindow({ speak, cancel });

    speakSign('HELLO');

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('HELLO');
  });

  it('cancels any in-flight utterance before speaking the next one', () => {
    const calls: string[] = [];
    const speak = vi.fn(() => calls.push('speak'));
    const cancel = vi.fn(() => calls.push('cancel'));
    stubWindow({ speak, cancel });

    speakSign('COFFEE');

    expect(calls).toEqual(['cancel', 'speak']);
  });

  it('stays silent when the learner has turned speech off', () => {
    useSettingsStore.setState({ speechEnabled: false });
    const speak = vi.fn();
    const cancel = vi.fn();
    stubWindow({ speak, cancel });

    speakSign('HELLO');

    expect(speak).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('does not throw when the browser has no speech synthesis', () => {
    // No `window` global at all in this environment by default — nothing to stub.
    expect(() => speakSign('HELLO')).not.toThrow();
  });
});
