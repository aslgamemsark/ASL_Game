const SEEN_KEY = 'asl-game-hand-check-done';

/**
 * Whether the one-time dominant-hand check (components/shared/DominantHandCheck.tsx) should be
 * shown. True until the user completes or skips it once, on whichever camera-based screen they
 * reach first — see PracticePage for where this is checked, right after the camera actually
 * turns on for real practice (moved out of onboarding, 2026-07-23).
 */
export function shouldShowHandCheck(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== 'true';
  } catch {
    return false; // storage blocked — treat as already seen rather than nag every session
  }
}

export function markHandCheckDone(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    /* storage blocked — shouldShowHandCheck will just keep returning false above, harmless */
  }
}
