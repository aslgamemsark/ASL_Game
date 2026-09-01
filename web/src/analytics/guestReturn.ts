/**
 * Guest D1/D7 return tracking. Guests have no server-side account, so `login`'s real session-based
 * dedup (see AuthContext.tsx) has nothing to key off for them — before this, a guest's return
 * behavior was entirely unmeasurable; only signed-in users' returning sessions were visible at all.
 *
 * Device-scoped via localStorage (the only durable-enough signal a guest has), which understates
 * real returns (a new browser/device/private window looks like a first visit) but never
 * overstates them — an acceptable one-sided bias for a retention metric, matching how most D1/D7
 * tooling already treats anonymous/logged-out traffic.
 */
import { todayStr, daysBetween } from '@/stores/useUserStore';

const LAST_SEEN_KEY = 'quicksign_guest_last_seen';

/**
 * Call once per app session for a guest (no signed-in user — callers should skip this entirely for
 * an authenticated user, whose real return behavior is already covered by `login`). Returns the
 * gap in days since this device's last recorded visit if this genuinely IS a return (a prior date
 * exists and differs from today); null on a first-ever visit or a same-day repeat open, neither of
 * which is a "return." Always updates the stored date to today as a side effect, so this is safe to
 * call at most once per mount, not once per render.
 */
export function checkGuestReturn(): number | null {
  try {
    const today = todayStr();
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    localStorage.setItem(LAST_SEEN_KEY, today);
    if (!lastSeen || lastSeen === today) return null;
    return daysBetween(lastSeen, today);
  } catch {
    return null; // storage blocked — this device's return simply can't be measured, not an error
  }
}
