import { useEffect, useRef } from 'react';
import { track } from './capture';
import type { ScreenName } from './types';

/**
 * Fires exactly one `screen_viewed` per screen change — in an effect (never during render, which
 * would double-fire under StrictMode and fire on every re-render, not just navigation). Pass the
 * current screen name from App.tsx's `Screen['type']` union; this hook tracks the previous value
 * itself so callers don't have to.
 */
export function useScreenView(screen: ScreenName): void {
  const previousRef = useRef<ScreenName | null>(null);

  useEffect(() => {
    track('screen_viewed', { screen, previous_screen: previousRef.current });
    previousRef.current = screen;
  }, [screen]);
}
