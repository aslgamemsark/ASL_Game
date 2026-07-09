import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { soundEffects } from '@/lib/soundEffects';

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

// Hearing users learning ASL rely on audio cues same as any other game would provide;
// vibration alone (the original scope of this hook) doesn't serve them. Sound and
// vibration are independently toggleable in Settings.
export function useSounds() {
  const vibrationRef = useRef(useSettingsStore.getState().vibrationEnabled);
  const soundRef = useRef(useSettingsStore.getState().soundEnabled);
  useEffect(() => useSettingsStore.subscribe((s) => {
    vibrationRef.current = s.vibrationEnabled;
    soundRef.current = s.soundEnabled;
  }), []);

  const correct = useCallback(() => {
    if (soundRef.current) soundEffects.correct();
    if (vibrationRef.current) vibrate([30, 40, 80]); // two pulses — positive
  }, []);

  const wrong = useCallback(() => {
    if (soundRef.current) soundEffects.wrong();
    if (vibrationRef.current) vibrate(200); // single long buzz — negative
  }, []);

  const levelUp = useCallback(() => {
    if (soundRef.current) soundEffects.levelUp();
    if (vibrationRef.current) vibrate([50, 30, 70, 30, 120]); // ascending celebration
  }, []);

  const tap = useCallback(() => {
    if (soundRef.current) soundEffects.tap();
    if (vibrationRef.current) vibrate(12); // tiny tap
  }, []);

  const streak = useCallback(() => {
    if (soundRef.current) soundEffects.streak();
    if (vibrationRef.current) vibrate([20, 15, 25, 15, 35, 15, 60]); // rapid escalating taps
  }, []);

  const purchase = useCallback(() => {
    if (soundRef.current) soundEffects.purchase();
    if (vibrationRef.current) vibrate([40, 30, 60]); // double tap
  }, []);

  const badgeUnlock = useCallback(() => {
    if (soundRef.current) soundEffects.badgeUnlock();
    if (vibrationRef.current) vibrate([30, 20, 60, 20, 120]); // triple pulse fanfare
  }, []);

  return { correct, wrong, levelUp, tap, streak, purchase, badgeUnlock, enabledRef: vibrationRef };
}
