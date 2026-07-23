/**
 * Shared timestamp formatting for admin-facing surfaces (AdminPanel, AnalyticsTab). One place so
 * every admin date reads the same way — a full, unambiguous absolute date/time, optionally with a
 * relative hint — instead of each screen calling the browser's locale-dependent toLocaleString()
 * directly. Raw toLocaleString() renders differently depending on the admin's OS locale, and
 * ambiguously even within one locale family: "7/23/2026" reads as July 23 in the US and as 23 July
 * in most of the rest of the world, with no way to tell which from the string alone.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Turns an ISO `YYYY-MM-DD` day into a short human label like "Jul 13" — used where only the
 *  calendar day matters (chart axis ticks, cohort-grid row labels), not a full timestamp. */
export function formatDayLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1] ?? month} ${Number(day)}`;
}

/** Coarse "how long ago" phrase for a millisecond delta. Returns null once the timestamp is old
 *  enough (>6 days) that a relative label stops being useful and would just read as clutter
 *  ("47 days ago") next to the absolute date that's already shown. */
function relativeLabel(deltaMs: number): string | null {
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day <= 6) return `${day} days ago`;
  return null;
}

/** Full, unambiguous admin timestamp — e.g. "Jul 13, 2026, 3:45 PM · 2 days ago". Month is spelled
 *  out so date order is never ambiguous, and a relative hint is appended for anything in the last
 *  week. `now` is injectable so callers/tests get a deterministic result rather than one that
 *  depends on the moment the function happens to run. */
export function formatAdminTimestamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const absolute = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hours}:${minutes} ${ampm}`;
  const rel = relativeLabel(now.getTime() - d.getTime());
  return rel ? `${absolute} · ${rel}` : absolute;
}

/** Compact date-only version for tight spaces (e.g. one feedback card row): "Jul 13, 2026" — same
 *  unambiguous month-name form as formatAdminTimestamp, just without the time-of-day component. */
export function formatAdminDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
