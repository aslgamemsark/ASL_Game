import { useState } from 'react';
import type { GateDecision } from '@/engine/gate';
import type { ClassifierStatus } from '@/hooks/useClassifier';
import { paramCleared, type VerifyResult } from '@/engine/verifier';
import { isClassifierDebugEnabled } from '@/config/classifier';

interface Props {
  status: ClassifierStatus;
  lastVote: GateDecision | null;
  /** Live rule-verifier result (same object driving the on-screen Sign Coach checklist) — shown
   * here too so a tester can see WHY the rules passed/failed without a separate lookup. */
  result?: VerifyResult | null;
}

/**
 * Debug overlay showing both layers of recognition — the rule verifier's live per-parameter
 * scores AND the ML veto layer's decision — so you can watch the whole pipeline work without
 * opening the console. Renders nothing unless `isClassifierDebugEnabled()` says so (on by
 * default under `vite dev`; opt-in elsewhere via `?debug=1` or a localStorage flag — see that
 * function's comment for why this can't be a build-time DEV-only gate).
 */
export function ClassifierDevPanel({ status, lastVote, result }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  if (!isClassifierDebugEnabled()) return null;

  return (
    <div className="fixed bottom-2 right-2 z-[9999] font-mono text-[11px] max-w-xs">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left bg-black/85 text-white px-2.5 py-1.5 rounded-t-lg border border-purple-500/50 flex items-center justify-between gap-2"
      >
        <span className="font-bold text-purple-300">🤖 Recognition debug ({status})</span>
        <span>{collapsed ? '▲' : '▼'}</span>
      </button>
      {!collapsed && (
        <div className="bg-black/85 text-white px-2.5 py-2 rounded-b-lg border border-t-0 border-purple-500/50 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
          {result && result.params.length > 0 && (
            <>
              <p className="text-purple-300 font-bold">Rule verifier — {result.signName}</p>
              {result.params.map((p) => (
                <p key={p.name} className="flex justify-between gap-2">
                  <span className={p.required ? '' : 'text-gray-500'}>
                    {p.name}{!p.required && ' (opt)'}:
                  </span>
                  <span className={paramCleared(p) ? 'text-green-400' : 'text-red-400'}>
                    {p.score.toFixed(2)} / {p.threshold.toFixed(2)}
                  </span>
                </p>
              ))}
              <p className="text-gray-400">
                Roles: dominant={result.roles.dominant ?? '?'}, nondominant={result.roles.nondominant ?? '?'}
              </p>
              <hr className="border-purple-500/30 my-1" />
            </>
          )}
          {!lastVote && <p className="text-gray-400">No AI vote yet — pass a sign to see gate output.</p>}
          {lastVote && (
            <>
              <p className="text-purple-300 font-bold">AI veto layer{!lastVote.enforced && ' (SHADOW MODE)'}</p>
              <p><span className="text-gray-400">Prompted:</span> {lastVote.prompted}</p>
              <p><span className="text-gray-400">AI top:</span> {lastVote.vote ? `${lastVote.vote.topSign} (${(lastVote.vote.confidence * 100).toFixed(1)}%)` : '(no vote)'}</p>
              <p>
                <span className="text-gray-400">Decision:</span>{' '}
                {/* `lastVote.decision` is the MODEL'S opinion, not the learner's result — in shadow
                    mode a 'veto' opinion still passes the learner. Showing bare "VETOED ✗" here
                    would read as "this blocked you" when it did not (bug found 2026-07-27: the
                    console logger got this shadow-mode distinction, this panel didn't). */}
                {lastVote.decision === 'veto' && lastVote.enforced && (
                  <span className="text-red-400 font-bold">VETOED ✗</span>
                )}
                {lastVote.decision === 'veto' && !lastVote.enforced && (
                  <span className="text-yellow-300 font-bold">PASS ✓ (AI wanted to veto — shadow mode, not enforced)</span>
                )}
                {lastVote.decision === 'pass' && (
                  <span className="text-green-400 font-bold">PASS ✓</span>
                )}
              </p>
              {lastVote.topK.length > 0 && (
                <p className="text-gray-400">
                  Top-{lastVote.topK.length}: {lastVote.topK.map((t) => `${t.sign} ${(t.prob * 100).toFixed(0)}%`).join(', ')}
                </p>
              )}
              {lastVote.hint && <p className="text-yellow-300">Hint: {lastVote.hint}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
