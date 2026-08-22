import { memo, useSyncExternalStore } from 'react';
import type { Sign } from '@/engine/schema';
import type { VerifyResult } from '@/engine/verifier';
import { ParameterChecklist } from './ParameterChecklist';

interface Props {
  /** Live-result subscription from useRecognition — stable identities, safe as plain props. */
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => VerifyResult | null;
  sign?: Sign | null;
  /** 0..1 static-sign hold progress (updates at the same 10 Hz cadence as the result). */
  holdProgress?: number | null;
  /** Passed through to ParameterChecklist (desktop three-column layout spacing). */
  fillHeight?: boolean;
}

/**
 * Isolated subscriber for the recognition loop's 10 Hz live result.
 *
 * WHY THIS EXISTS (shipping-readiness v2 audit): `result` is React state inside the page-level
 * useRecognition instance, so every page reading `recognition.result` re-rendered its ENTIRE
 * tree 10×/s for the whole signing phase — header, prompts, buttons, framer-motion panels,
 * everything below it. This component moves that churn into the smallest possible subtree:
 * the page passes the stable subscribe/getSnapshot pair, and ONLY this wrapper re-renders at
 * 10 Hz via useSyncExternalStore. Rendering is delegated to the unchanged ParameterChecklist,
 * so pixels, coaching-gate behavior and the screen-reader announcement contract are identical
 * to the previous inline `{recognition.result && <ParameterChecklist …/>}` usage.
 *
 * Renders nothing until the first result publishes (same conditional the pages had).
 */
export const LiveSignCoach = memo(function LiveSignCoach({
  subscribe,
  getSnapshot,
  sign,
  holdProgress,
  fillHeight,
}: Props) {
  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!result) return null;
  return (
    <ParameterChecklist
      params={result.params}
      sign={sign}
      holdProgress={holdProgress}
      fillHeight={fillHeight}
    />
  );
});
