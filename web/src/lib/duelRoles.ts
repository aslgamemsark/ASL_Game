/**
 * Single source of truth for duel role assignment (who signs vs. who guesses each round).
 *
 * This rule was previously duplicated inline in three places in DuelPage — the host 'join'
 * handler, the joiner 'start' handler, and advanceRound. A copy that drifted out of sync
 * (`user.id > hostId` instead of `< hostId`) made both clients compute the SAME role, so both
 * players signed at once (or neither did). Collapsing the rule into one pure function removes that
 * whole class of bug and makes it unit-testable.
 *
 * Rule: the player with the lexicographically smaller id signs on odd rounds; roles alternate
 * every round after that. `round` is 1-indexed. For any two distinct ids and any round, exactly
 * one of the two players is the signer (the function returns opposite values for the two sides).
 */
export function isSignerForRound(myId: string, opponentId: string, round: number): boolean {
  const smallerSignsThisRound = round % 2 === 1;
  const iAmSmaller = myId < opponentId;
  return iAmSmaller === smallerSignsThisRound;
}
