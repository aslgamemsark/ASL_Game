/**
 * Minimal external store for high-frequency recognition signals (live verify() results,
 * static-hold progress). Consumed via `useSyncExternalStore` inside small isolated subscriber
 * components (LiveSignCoach, ClassifierDevPanel, CalibrationPage's live panels) so a 10 Hz
 * data stream never re-renders the page that owns the useRecognition instance.
 *
 * Extracted 2026-08-25 (ASL-A1 / round-4 finding F1+F2): the result store previously lived as a
 * ref-shaped closure inside useRecognition while `result` ALSO existed as React state — the dual
 * publish kept the whole page tree re-rendering at the publish cadence. One mechanism, two
 * signals: both stores are plain instances of this, and the hook holds zero page-visible state
 * for either signal anymore.
 *
 * Contract (matches useSyncExternalStore requirements):
 * - getSnapshot returns a STABLE reference between publishes (Object.is-equal ⇒ no re-render);
 *   callers must publish a fresh value when data genuinely changes (verify() never repeats a
 *   reference; holdProgress publishes distinct numbers/null transitions).
 * - subscribe/unsubscribe are idempotent-safe and leak-free (Set membership).
 */
export interface ExternalStore<T> {
  /** Store a new snapshot and notify every subscriber synchronously. */
  publish(value: T): void;
  /** Register a listener; returns its unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Current snapshot — referentially stable until the next publish. */
  getSnapshot(): T;
}

export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    publish(value: T) {
      current = value;
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          // One broken subscriber must neither starve the others mid-iteration nor corrupt the
          // store — same swallow-and-log discipline as useProgressSync's telemetry helpers.
          console.error('[QuickSign] store listener threw:', e);
        }
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return current;
    },
  };
}
