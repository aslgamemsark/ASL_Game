/** Shared helpers for the multiplayer_rooms registry (see the matching Supabase migration),
 * used by DuelPage, RoomPage, and App.tsx's challenge-friend flow — kept in one place so the
 * three call sites can't drift on code generation or on how a join failure reads to the user. */

export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Maps join_multiplayer_room's raised Postgres exception message to user-facing copy. */
export function joinErrorMessage(message: string): string {
  if (message.includes('not found')) return 'Invalid code — no room with that code exists.';
  if (message.includes('full')) return 'That room is already full.';
  if (message.includes('already started')) return 'That game has already started.';
  if (message.includes('closed')) return 'That room has closed.';
  return 'Could not join that room — please try again.';
}
