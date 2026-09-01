export interface SpeedRoundClock {
  signId: string;
  timeLeft: number;
}

export function shouldTickSpeedRoundClock(cameraActive: boolean): boolean {
  return cameraActive;
}

/** One 100 ms Speed tick, called only while the camera policy permits timing. */
export function tickSpeedRoundClock(clock: SpeedRoundClock) {
  if (clock.timeLeft <= 0.11) return { ...clock, timeLeft: 0, timedOut: true };
  return { ...clock, timeLeft: +(clock.timeLeft - 0.1).toFixed(1), timedOut: false };
}
