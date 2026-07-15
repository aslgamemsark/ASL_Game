/**
 * Truncates a string to at most `max` UTF-16 code units without splitting a surrogate pair.
 * Plain `.slice(0, max)` can cut a two-unit character (many emoji) in half, leaving a lone
 * surrogate that renders as a broken glyph and can corrupt anything downstream that assumes
 * well-formed UTF-16 (e.g. a DB column, JSON.stringify).
 */
export function safeTruncate(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const codeBefore = s.charCodeAt(end - 1);
  if (codeBefore >= 0xd800 && codeBefore <= 0xdbff) end -= 1;
  return s.slice(0, end);
}
