import { useEffect, useState, useCallback } from 'react';
import { loadClassifier, type SignClassifier } from '@/engine/classifier';
import type { GateDecision } from '@/engine/gate';
import { MODEL_URL, CLASSES_URL, CLASSIFIER_LOAD_ENABLED, isClassifierDebugEnabled } from '@/config/classifier';
import { track, isKillSwitchOn } from '@/analytics';

export type ClassifierStatus = 'disabled' | 'loading' | 'ready';

interface LoadResult {
  classifier: SignClassifier | null;
  status: ClassifierStatus;
}

// Module-level cache so the (potentially multi-MB) model loads ONCE for the whole app,
// not once per page mount.
let cached: Promise<LoadResult> | null = null;

async function fetchClasses(): Promise<string[] | null> {
  try {
    const res = await fetch(CLASSES_URL);
    if (!res.ok) return null; // no model deployed -> silently disabled
    const data = await res.json();
    return Array.isArray(data) ? (data as string[]) : null;
  } catch {
    return null;
  }
}

function loadOnce(): Promise<LoadResult> {
  if (!cached) {
    const startedAt = performance.now();
    cached = (async () => {
      // Master load switch (config/classifier.ts) — checked before any network/WASM work so
      // flipping it off genuinely stops the download, not just the veto's effect.
      if (!CLASSIFIER_LOAD_ENABLED) return { classifier: null, status: 'disabled' as const };
      // Emergency kill switch — same reasoning as useCamera's disable_camera. Falls back to the
      // rules-only path (identical to "no model deployed"), never breaks recognition outright.
      if (isKillSwitchOn('disable_classifier')) return { classifier: null, status: 'disabled' as const };
      const classes = await fetchClasses();
      if (!classes) {
        track('ai_model_unavailable', {});
        return { classifier: null, status: 'disabled' as const };
      }
      const c = await loadClassifier(MODEL_URL, classes);
      if (c.enabled) {
        track('ai_model_loaded', { load_ms: Math.round(performance.now() - startedAt) });
        return { classifier: c, status: 'ready' as const };
      }
      track('ai_model_unavailable', {});
      return { classifier: null, status: 'disabled' as const };
    })();
  }
  return cached;
}

/**
 * Loads the optional TF.js disambiguation model (once, app-wide) and returns a ready-made
 * decision logger. Always safe: if no model is deployed, `classifier` is null and the app
 * runs on the rule verifier alone.
 *
 *   const { classifier, status, logVote } = useClassifier();
 *   const recognition = useRecognition({ onPass, classifier, onVote: logVote });
 *
 * `enabled` (default true) lets a caller defer the actual load — e.g. App.tsx's app-wide
 * prefetch skips loading until onboarding finishes, since starting this multi-MB fetch +
 * WASM/WebGL init immediately on first paint was making the "Get Started" button feel frozen
 * for several seconds (impeccable audit, 2026-07-11). Lesson/Practice/Story pages that actually
 * need the classifier keep calling this with the default (true) — they hit the same module-level
 * cache, so nothing double-loads.
 */
export function useClassifier(enabled: boolean = true) {
  const [state, setState] = useState<LoadResult>({ classifier: null, status: 'loading' });
  const [lastVote, setLastVote] = useState<GateDecision | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadOnce().then((r) => {
      if (!active) return;
      setState(r);
      // Expose the final status for tooling (perf-probe.mjs asserts 'ready' before sampling —
      // a measurement taken while the classifier failed/disabled would silently exclude
      // TF.js inference and not be a production number).
      (window as unknown as { __classifierStatus?: string }).__classifierStatus = r.status;
      if (isClassifierDebugEnabled()) {
        console.log(`[classifier] ${r.status}${r.status === 'ready' ? ' — disambiguation active' : ''}`);
      }
    });
    return () => { active = false; };
  }, [enabled]);

  // Gated debug logger for gate decisions. Stable identity across renders.
  // TEMPORARY DEBUG: prints a labeled per-prediction breakdown proving the AI classifier is
  // live (rule vs AI vs final, and whether the AI changed/vetoed the rule). Logging only —
  // it reads the already-computed GateDecision and changes no behavior.
  const logVote = useCallback((d: GateDecision) => {
    // Feeds the ClassifierDevPanel — same runtime check as the console logging below (see
    // isClassifierDebugEnabled's comment for why this can't be a build-time DEV-only gate).
    if (!isClassifierDebugEnabled()) return;
    setLastVote(d);
    const ai = d.vote;
    // The gate only runs AFTER the rule verifier passed for the prompted sign, so the rule's
    // prediction here is the prompted sign.
    const rulePred = d.prompted;
    const aiPred = ai ? ai.topSign : '(no vote)';
    const aiConf = ai ? `${(ai.confidence * 100).toFixed(1)}%` : 'n/a';
    // In shadow mode a 'veto' decision is recorded but NOT applied, so the learner still passed.
    const finalPred = d.decision === 'pass' || !d.enforced ? d.prompted : '(rejected — no pass)';

    let aiEffect: string;
    if (!ai) aiEffect = 'AI produced no vote — rule result UNCHANGED';
    else if (d.decision === 'veto' && !d.enforced) aiEffect = `AI wanted to veto (it saw "${ai.topSign}", not "${d.prompted}") — SHADOW MODE, not enforced, learner PASSED`;
    else if (d.decision === 'veto') aiEffect = `AI VETOED the rule ✗ (it saw "${ai.topSign}", not "${d.prompted}")`;
    else if (ai.topSign !== d.prompted) aiEffect = `AI disagreed ("${ai.topSign}") but below veto threshold — rule UNCHANGED`;
    else aiEffect = 'AI agreed with the rule ✓ — rule UNCHANGED';

    const tk = d.topK.map((t) => `${t.sign} ${(t.prob * 100).toFixed(0)}%`).join(', ');

    console.log(
      '%c[AI-DEBUG] classifier ACTIVE — prediction breakdown',
      'color:#7c3aed;font-weight:bold',
      `\n  Rule prediction  : ${rulePred} (rule PASS)` +
      `\n  AI prediction    : ${aiPred}` +
      `\n  AI confidence    : ${aiConf}` +
      `\n  Final prediction : ${finalPred}` +
      `\n  AI effect        : ${aiEffect}` +
      `\n  AI top-3         : ${tk}` +
      (d.hint ? `\n  Hint shown       : "${d.hint}"` : '')
    );
    (window as unknown as { __lastVote?: GateDecision }).__lastVote = d;
  }, []);

  return { classifier: state.classifier, status: state.status, logVote, lastVote };
}
