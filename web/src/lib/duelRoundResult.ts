export interface DuelRoundResult {
  round: number;
  signerScored: boolean;
  guesserScored: boolean;
}

export function replayDuelResult(saved: DuelRoundResult | null, requestedRound: unknown,
  requester: string, opponent: string): DuelRoundResult | null {
  return requester === opponent && saved?.round === requestedRound ? saved : null;
}

/** Broadcasts have no replay; bound recovery so a missing peer never leaves a silent spinner. */
export function requestDuelResultWithRetry(request: () => void, failed: () => void): () => void {
  let attempts = 1;
  request();
  const timer = setInterval(() => {
    if (attempts >= 5) { clearInterval(timer); failed(); return; }
    attempts += 1;
    request();
  }, 1200);
  return () => clearInterval(timer);
}

/** Only the current signer settles a round; stale and duplicate broadcasts are ignored. */
export function acceptDuelResult(
  payload: Record<string, unknown>,
  from: string,
  signerId: string,
  round: number,
  lastResolvedRound: number,
): DuelRoundResult | null {
  if (from !== signerId || payload.round !== round || round <= lastResolvedRound
    || typeof payload.signerScored !== 'boolean' || typeof payload.guesserScored !== 'boolean') return null;
  return { round, signerScored: payload.signerScored, guesserScored: payload.guesserScored };
}
