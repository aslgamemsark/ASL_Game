import { describe, expect, it } from 'vitest';
import { shouldTickSpeedRoundClock, tickSpeedRoundClock } from '../speedRoundClock';

describe('Speed round clock', () => {
  it('pauses scheduling while the camera is unavailable', () => {
    expect(shouldTickSpeedRoundClock(false, true)).toBe(false);
    expect(shouldTickSpeedRoundClock(true, false)).toBe(false);
    expect(shouldTickSpeedRoundClock(true, true)).toBe(true);
  });

  it('resumes the same sign and only times out with an active camera', () => {
    expect(tickSpeedRoundClock({ signId: 'HELLO', timeLeft: 4.2 })).toEqual({
      signId: 'HELLO',
      timeLeft: 4.1,
      timedOut: false,
    });
    expect(tickSpeedRoundClock({ signId: 'HELLO', timeLeft: 0.1 })).toEqual({
      signId: 'HELLO',
      timeLeft: 0,
      timedOut: true,
    });
  });
});
