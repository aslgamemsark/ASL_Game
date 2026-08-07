import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * Speaks a sign's English name aloud on a successful attempt. No-ops silently when the browser
 * has no speech synthesis or the learner has turned speech off — callers never branch on
 * availability. Cancels any in-flight utterance first: a learner signing quickly must hear the
 * sign they just made, not queue behind the previous one.
 */
export function speakSign(name: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!useSettingsStore.getState().speechEnabled) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(name));
}
