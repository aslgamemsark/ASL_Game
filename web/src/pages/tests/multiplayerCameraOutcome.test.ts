import { describe, expect, it } from 'vitest';

const pages = import.meta.glob('/src/pages/{DuelPage,RoomPage}.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('multiplayer camera recovery', () => {
  it('records an interrupted signer attempt before stopping each recognition loop', () => {
    for (const page of Object.values(pages)) {
      expect(page).toMatch(/recognition\.finalizeAttempt\('camera_interruption', signaling\.camStatus\)/);
    }
  });
});
