/** Shared helpers for the multiplayer_rooms registry (see the matching Supabase migration),
 * used by DuelPage, RoomPage, and App.tsx's challenge-friend flow — kept in one place so the
 * three call sites can't drift on code generation or on how a join failure reads to the user. */

/** Room codes gate entry to live-webcam sessions, so they must resist guessing:
 * crypto.getRandomValues (not Math.random, which is predictable and could yield short codes via
 * trailing-zero loss), fixed 8 chars from a 32-symbol alphabet (40 bits) with 0/O/1/I removed so
 * codes are unambiguous when read aloud or retyped. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Maps join_multiplayer_room's raised Postgres exception message to user-facing copy. */
export function joinErrorMessage(message: string): string {
  if (message.includes('not found')) return 'Invalid code — no room with that code exists.';
  if (message.includes('full')) return 'That room is already full.';
  if (message.includes('already started')) return 'That game has already started.';
  if (message.includes('closed')) return 'That room has closed.';
  if (message.includes('too many join attempts')) return 'Too many attempts — wait a minute and try again.';
  return 'Could not join that room — please try again.';
}

// ── Custom room rules ─────────────────────────────────────────────────────────
// Host-chosen match settings. Carried to other players inside the existing game-start signaling
// payload (NOT the DB), so no migration is required and a client that doesn't receive them falls
// back to the defaults below — keeping the pre-existing behavior when rules aren't set.

export type SignSet = 'all' | 'letters' | 'words';

export interface RoomRules {
  /** Duel: total rounds. Room: rounds per player. */
  rounds: number;
  /** Seconds each signer gets per turn. */
  turnSeconds: number;
  /** Which pool of signs to draw from. */
  signSet: SignSet;
}

export const DEFAULT_DUEL_RULES: RoomRules = { rounds: 5, turnSeconds: 15, signSet: 'all' };
export const DEFAULT_ROOM_RULES: RoomRules = { rounds: 2, turnSeconds: 15, signSet: 'all' };

export const DUEL_ROUNDS_OPTIONS = [3, 5, 7];
export const ROOM_ROUNDS_OPTIONS = [1, 2, 3];
export const TURN_SECONDS_OPTIONS = [10, 15, 20];

/** Filters a sign-id pool by the chosen set. Letter signs are ids prefixed `LETTER_`
 *  (see data/alphabet.ts); everything else is a word sign. */
export function filterSignPool(all: string[], set: SignSet): string[] {
  if (set === 'letters') return all.filter((s) => s.startsWith('LETTER_'));
  if (set === 'words') return all.filter((s) => !s.startsWith('LETTER_'));
  return all;
}

/** Picks up to n distinct signs from a pool at random. Returns fewer than n only if the pool is
 *  smaller (round count is derived from the resulting length, so that stays consistent). */
export function pickSignsFrom(pool: string[], n: number): string[] {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

/** Short human-readable summary of a ruleset, e.g. "5 rounds · 15s · Letters". */
export function describeRules(rules: RoomRules, roundsWord = 'rounds'): string {
  const set = rules.signSet === 'letters' ? 'Letters' : rules.signSet === 'words' ? 'Words' : 'All signs';
  return `${rules.rounds} ${roundsWord} · ${rules.turnSeconds}s · ${set}`;
}
