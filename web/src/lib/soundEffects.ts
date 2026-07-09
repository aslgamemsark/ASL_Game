// Synthesized UI sound effects via Web Audio API — no asset files to ship/license.
// AudioContext must be created after a user gesture (browser autoplay policy), so it's
// lazily instantiated on first play() call rather than at module load.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface Note {
  freq: number;
  start: number; // seconds from now
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number;
}

function playNotes(notes: Note[]) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  for (const { freq, start, duration, type = 'sine', gain = 0.2 } of notes) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const t0 = now + start;
    const t1 = t0 + duration;
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.015, duration / 4));
    gainNode.gain.exponentialRampToValueAtTime(0.001, t1);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export const soundEffects = {
  correct: () => playNotes([
    { freq: 880, start: 0, duration: 0.09, type: 'sine', gain: 0.22 },
    { freq: 1318.5, start: 0.08, duration: 0.14, type: 'sine', gain: 0.22 },
  ]),
  wrong: () => playNotes([
    { freq: 196, start: 0, duration: 0.22, type: 'sawtooth', gain: 0.15 },
  ]),
  levelUp: () => playNotes([
    { freq: 523.25, start: 0, duration: 0.1, type: 'triangle', gain: 0.2 },
    { freq: 659.25, start: 0.1, duration: 0.1, type: 'triangle', gain: 0.2 },
    { freq: 783.99, start: 0.2, duration: 0.1, type: 'triangle', gain: 0.2 },
    { freq: 1046.5, start: 0.3, duration: 0.25, type: 'triangle', gain: 0.24 },
  ]),
  tap: () => playNotes([
    { freq: 600, start: 0, duration: 0.035, type: 'sine', gain: 0.1 },
  ]),
  streak: () => playNotes([
    { freq: 700, start: 0, duration: 0.06, type: 'square', gain: 0.14 },
    { freq: 850, start: 0.06, duration: 0.06, type: 'square', gain: 0.14 },
    { freq: 1000, start: 0.12, duration: 0.06, type: 'square', gain: 0.14 },
    { freq: 1200, start: 0.18, duration: 0.12, type: 'square', gain: 0.18 },
  ]),
  purchase: () => playNotes([
    { freq: 987.77, start: 0, duration: 0.07, type: 'sine', gain: 0.2 },
    { freq: 1318.5, start: 0.06, duration: 0.16, type: 'sine', gain: 0.2 },
  ]),
  badgeUnlock: () => playNotes([
    { freq: 523.25, start: 0, duration: 0.09, type: 'triangle', gain: 0.2 },
    { freq: 659.25, start: 0.09, duration: 0.09, type: 'triangle', gain: 0.2 },
    { freq: 783.99, start: 0.18, duration: 0.09, type: 'triangle', gain: 0.2 },
    { freq: 1046.5, start: 0.27, duration: 0.35, type: 'triangle', gain: 0.26 },
  ]),
};
