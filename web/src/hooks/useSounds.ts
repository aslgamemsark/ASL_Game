import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext : null;

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
  } catch {}
}

function playChord(freqs: number[], duration: number, volume = 0.1) {
  for (const f of freqs) playTone(f, duration, 'sine', volume);
}

export function useSounds() {
  // Kept as a ref (not just reading the store inline) so every callback below stays a stable,
  // dependency-free useCallback — the ref always points at the latest store value without
  // forcing every sound function to be recreated on each toggle.
  const enabledRef = useRef(useSettingsStore.getState().soundEnabled);
  useEffect(() => useSettingsStore.subscribe((s) => { enabledRef.current = s.soundEnabled; }), []);

  const correct = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(523, 0.1, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 80);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 160);
  }, []);

  const wrong = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(200, 0.15, 'square', 0.08);
    setTimeout(() => playTone(180, 0.2, 'square', 0.06), 120);
  }, []);

  const levelUp = useCallback(() => {
    if (!enabledRef.current) return;
    playChord([523, 659, 784], 0.12);
    setTimeout(() => playChord([587, 740, 880], 0.12), 150);
    setTimeout(() => playChord([659, 784, 1047], 0.25), 300);
  }, []);

  const tap = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(880, 0.05, 'sine', 0.06);
  }, []);

  const streak = useCallback(() => {
    if (!enabledRef.current) return;
    const notes = [523, 587, 659, 784, 880, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.08, 'sine', 0.08), i * 60);
    });
  }, []);

  const purchase = useCallback(() => {
    if (!enabledRef.current) return;
    playTone(660, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(990, 0.12, 'sine', 0.1), 70);
  }, []);

  const badgeUnlock = useCallback(() => {
    if (!enabledRef.current) return;
    playChord([440, 554, 659], 0.15);
    setTimeout(() => playChord([554, 659, 880], 0.3), 180);
  }, []);

  return { correct, wrong, levelUp, tap, streak, purchase, badgeUnlock, enabledRef };
}
