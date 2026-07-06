import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

export function useSounds() {
  const enabledRef = useRef(useSettingsStore.getState().vibrationEnabled);
  useEffect(() => useSettingsStore.subscribe((s) => { enabledRef.current = s.vibrationEnabled; }), []);

  const correct = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate([30, 40, 80]); // two pulses — positive
  }, []);

  const wrong = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate(200); // single long buzz — negative
  }, []);

  const levelUp = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate([50, 30, 70, 30, 120]); // ascending celebration
  }, []);

  const tap = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate(12); // tiny tap
  }, []);

  const streak = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate([20, 15, 25, 15, 35, 15, 60]); // rapid escalating taps
  }, []);

  const purchase = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate([40, 30, 60]); // double tap
  }, []);

  const badgeUnlock = useCallback(() => {
    if (!enabledRef.current) return;
    vibrate([30, 20, 60, 20, 120]); // triple pulse fanfare
  }, []);

  return { correct, wrong, levelUp, tap, streak, purchase, badgeUnlock, enabledRef };
}
