/** Computes the next index for ArrowLeft/ArrowRight/Home/End on a roving-tabindex tablist, per
 *  the WAI-ARIA tabs pattern. Returns null for any other key (caller should not preventDefault). */
export function nextTabIndex(key: string, currentIndex: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight': return (currentIndex + 1) % count;
    case 'ArrowLeft': return (currentIndex - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}
