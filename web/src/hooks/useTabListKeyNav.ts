import { useRef, type KeyboardEvent } from 'react';
import { nextTabIndex } from '@/lib/tabListNav';

/** Wires roving-tabindex arrow-key navigation for a WAI-ARIA tablist: ref callback for each tab
 *  button, and a keydown handler that moves both selection and focus per `nextTabIndex`. `onSelect`
 *  is called with the newly-focused tab's id — the same function the tab's onClick should use, so
 *  keyboard and pointer selection stay in sync by construction. */
export function useTabListKeyNav<T extends string>(tabs: readonly T[], onSelect: (id: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const next = nextTabIndex(e.key, currentIndex, tabs.length);
    if (next === null) return;
    e.preventDefault();
    onSelect(tabs[next]);
    refs.current[next]?.focus();
  };

  const refFor = (i: number) => (el: HTMLButtonElement | null) => { refs.current[i] = el; };

  return { refFor, onKeyDown };
}
