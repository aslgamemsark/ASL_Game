/**
 * Dev-only browser calibration harness — the TS/browser twin of tools/demo_verify.py --calibrate.
 *
 * Same idea as the Python tool: perform a sign CORRECTLY, then perform its likeliest accidental
 * false positive (the CONFUSOR), and this logs every frame's per-parameter verifier scores into
 * two buckets so a vague "it feels off" turns into a specific number — which parameter, correct
 * vs. confusor, median/min/max against its actual threshold.
 *
 * Reachable only at /calibrate in dev (see App.tsx's import.meta.env.DEV gate) — never bundled
 * into production, same pattern as /avatarlab.
 */
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { SIGNS } from '@/engine/signs';
import { median } from '@/engine/math-utils';
import type { VerifyResult } from '@/engine/verifier';

type Phase = 'idle' | 'correct' | 'confusor';

// Timed capture: press SPACE to auto-record CORRECT for this many ms, ENTER for CONFUSOR — no
// manual stop needed, so you can keep both hands on the sign instead of reaching for the mouse.
const AUTO_RECORD_MS = 4000;

interface LogRow {
  phase: 'correct' | 'confusor';
  frameIdx: number;
  paramName: string;
  score: number;
  threshold: number;
  required: boolean;
}

interface NoteEntry {
  timestamp: number;
  sign: string;
  phase: Phase;
  frameIdx: number;
  text: string;
}

const PHASE_COLOR: Record<Phase, string> = {
  idle: '#888',
  correct: '#2ecc71',
  confusor: '#e74c3c',
};

function stats(vals: number[]): string {
  if (vals.length === 0) return 'n=0 --/--/--';
  const sorted = [...vals].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return `n=${vals.length} med=${median(vals).toFixed(2)} min=${min.toFixed(2)} max=${max.toFixed(2)}`;
}

function downloadNotes(signName: string, notes: NoteEntry[]) {
  const header = 'timestamp,sign,phase,frame_idx,text';
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = notes.map((n) =>
    [new Date(n.timestamp).toISOString(), n.sign, n.phase, n.frameIdx, esc(n.text)].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${signName}_notes_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(signName: string, rows: LogRow[]) {
  const header = 'phase,frame_idx,param_name,score,threshold,required';
  const lines = rows.map((r) =>
    [r.phase, r.frameIdx, r.paramName, r.score.toFixed(4), r.threshold.toFixed(4), r.required].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${signName}_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Isolated subscriber for the 10 Hz live scores (ASL-A1): useSyncExternalStore over the result
 * store, mirroring LiveSignCoach's pattern — only THIS component re-renders per publish, the
 * calibration page itself stays quiet. Renders nothing until the first result publishes.
 */
function CalibrationLiveScores({ subscribe, getSnapshot }: {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => VerifyResult | null;
}) {
  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!result) return null;
  return (
    <>
      {result.params.map((p) => {
        const cleared = p.score >= p.threshold;
        return (
          <div key={p.name} style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ display: 'inline-block', width: 160 }}>{p.name} [{p.required ? 'req' : 'opt'}]</span>
            <span style={{ display: 'inline-block', width: 120, background: '#333', borderRadius: 4, overflow: 'hidden', height: 10, verticalAlign: 'middle' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, p.score * 100)}%`, background: cleared ? '#2ecc71' : '#e74c3c' }} />
            </span>
            <span style={{ marginLeft: 8, color: cleared ? '#2ecc71' : '#e74c3c' }}>
              {p.score.toFixed(2)} / {p.threshold.toFixed(2)}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function CalibrationPage() {
  const signNames = Object.keys(SIGNS).sort();
  const [signName, setSignName] = useState('COFFEE');
  const sign = SIGNS[signName];

  const { videoRef, status: camStatus, start: startCam } = useCamera();
  const recognition = useRecognition();

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const [autoRemainingMs, setAutoRemainingMs] = useState<number | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIdxRef = useRef<Record<'correct' | 'confusor', number>>({ correct: 0, confusor: 0 });
  const logRef = useRef<LogRow[]>([]);
  const [logCount, setLogCount] = useState({ correct: 0, confusor: 0 });
  const [report, setReport] = useState<
    { name: string; required: boolean; threshold: number; correct: string; confusor: string; flags: string[] }[]
    | null
  >(null);

  // Free-text observations ("that felt loose", "it accepted my hand too far right") tagged with
  // whatever sign/phase/frame was active when logged — turns a vague in-the-moment impression into
  // something searchable against the numeric log afterward instead of relying on memory.
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<NoteEntry[]>([]);

  const logNote = useCallback(() => {
    const text = noteText.trim();
    if (!text) return;
    setNotes((prev) => [
      ...prev,
      { timestamp: Date.now(), sign: signName, phase: phaseRef.current, frameIdx: frameIdxRef.current[phaseRef.current === 'idle' ? 'correct' : phaseRef.current], text },
    ]);
    setNoteText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteText, signName]);

  useEffect(() => {
    void recognition.init();
  }, [recognition]);

  useEffect(() => {
    void startCam();
  }, [startCam]);

  useEffect(() => {
    if (camStatus === 'active' && videoRef.current && recognition.status !== 'running') {
      recognition.startLoop(videoRef.current, sign);
    }
    // Re-arm the loop whenever the selected sign changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camStatus, signName]);

  // Log every frame's params while a phase is active. ASL-A1: this page no longer re-renders per
  // publish (the old [recognition.result]-keyed effect died with page-level result state), so the
  // logger subscribes to the result store directly and reads phaseRef (not state) — correct
  // across publishes without ever re-subscribing.
  useEffect(() => {
    return recognition.subscribeResult(() => {
      const p = phaseRef.current;
      const vr = recognition.getResultSnapshot();
      if (p === 'idle' || !vr) return;
      const idx = frameIdxRef.current[p]++;
      for (const param of vr.params) {
        logRef.current.push({
          phase: p,
          frameIdx: idx,
          paramName: param.name,
          score: param.score,
          threshold: param.threshold,
          required: param.required,
        });
      }
      setLogCount({ correct: frameIdxRef.current.correct, confusor: frameIdxRef.current.confusor });
    });
  }, [recognition]);

  const clearAutoTimers = useCallback(() => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (autoTickRef.current) { clearInterval(autoTickRef.current); autoTickRef.current = null; }
    setAutoRemainingMs(null);
  }, []);

  const togglePhase = useCallback((target: 'correct' | 'confusor') => {
    clearAutoTimers();
    setPhase((cur) => (cur === target ? 'idle' : target));
    setReport(null);
  }, [clearAutoTimers]);

  // SPACE (CORRECT) / ENTER (CONFUSOR): records for AUTO_RECORD_MS then auto-stops — no manual
  // stop click needed, so both hands stay on the sign the whole time.
  const startTimedPhase = useCallback((target: 'correct' | 'confusor') => {
    clearAutoTimers();
    setReport(null);
    setPhase(target);
    const startedAt = Date.now();
    autoTickRef.current = setInterval(() => {
      setAutoRemainingMs(Math.max(0, AUTO_RECORD_MS - (Date.now() - startedAt)));
    }, 100);
    autoStopRef.current = setTimeout(() => {
      setPhase('idle');
      clearAutoTimers();
    }, AUTO_RECORD_MS);
  }, [clearAutoTimers]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      if (phaseRef.current !== 'idle') return;
      if (e.code === 'Space') { e.preventDefault(); startTimedPhase('correct'); }
      else if (e.code === 'Enter') { e.preventDefault(); startTimedPhase('confusor'); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startTimedPhase]);

  useEffect(() => () => clearAutoTimers(), [clearAutoTimers]);

  const resetLog = useCallback(() => {
    clearAutoTimers();
    logRef.current = [];
    frameIdxRef.current = { correct: 0, confusor: 0 };
    setLogCount({ correct: 0, confusor: 0 });
    setReport(null);
    setPhase('idle');
  }, [clearAutoTimers]);

  const buildReport = useCallback(() => {
    const rows = logRef.current;
    if (rows.length === 0) return;
    const paramNames = Array.from(new Set(rows.map((r) => r.paramName)));
    const out = paramNames.map((name) => {
      const rowsForParam = rows.filter((r) => r.paramName === name);
      const correctVals = rowsForParam.filter((r) => r.phase === 'correct').map((r) => r.score);
      const confusorVals = rowsForParam.filter((r) => r.phase === 'confusor').map((r) => r.score);
      const required = rowsForParam[0]?.required ?? false;
      const threshold = rowsForParam[0]?.threshold ?? 0;
      const flags: string[] = [];
      if (required && correctVals.length && median(correctVals) < threshold) {
        flags.push('FALSE-FAIL risk (correct performance scores below threshold)');
      }
      if (required && confusorVals.length && median(confusorVals) >= threshold) {
        flags.push('FALSE-PASS risk (confusor scores above threshold)');
      }
      return {
        name,
        required,
        threshold,
        correct: stats(correctVals),
        confusor: stats(confusorVals),
        flags,
      };
    });
    setReport(out);
  }, []);


  return (
    <div style={{ fontFamily: 'monospace', background: '#111', color: '#eee', minHeight: '100vh', padding: 16 }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Calibration harness — {signName}</h1>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
        Dev-only (/calibrate). Pick a sign, then press <b>SPACE</b> to auto-record CORRECT (or{' '}
        <b>ENTER</b> for CONFUSOR) for {AUTO_RECORD_MS / 1000}s — no click needed, just perform the
        sign. The buttons below still work too (click again to stop manually). Press "Build report"
        to see per-parameter medians against the real thresholds, and "Download CSV" to save every
        raw frame. Use the Notes box any time to jot what looked wrong in plain English — it's
        tagged with the current sign/phase/frame automatically so you can match it back up against
        the numbers later.
      </p>

      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <video ref={videoRef} autoPlay playsInline muted width={320} height={240}
                 style={{ background: '#000', transform: 'scaleX(-1)', borderRadius: 8 }} />
          <p style={{ fontSize: 12, marginTop: 4 }}>camera: {camStatus} · recognition: {recognition.status}</p>

          <select value={signName} onChange={(e) => { setSignName(e.target.value); resetLog(); }}
                  style={{ marginTop: 8, background: '#222', color: '#eee', padding: 4 }}>
            {signNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => togglePhase('correct')}
                    style={{ background: phase === 'correct' ? '#2ecc71' : '#333', color: '#fff', padding: '6px 10px', border: 'none', borderRadius: 6 }}>
              {phase === 'correct' ? '■ stop CORRECT' : '● record CORRECT'} ({logCount.correct})
            </button>
            <button onClick={() => togglePhase('confusor')}
                    style={{ background: phase === 'confusor' ? '#e74c3c' : '#333', color: '#fff', padding: '6px 10px', border: 'none', borderRadius: 6 }}>
              {phase === 'confusor' ? '■ stop CONFUSOR' : '● record CONFUSOR'} ({logCount.confusor})
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={buildReport} style={{ padding: '6px 10px' }}>Build report</button>
            <button onClick={() => downloadCsv(signName, logRef.current)} style={{ padding: '6px 10px' }}>Download CSV</button>
            <button onClick={resetLog} style={{ padding: '6px 10px' }}>Reset</button>
          </div>
          <p style={{ marginTop: 8, fontWeight: 'bold', color: PHASE_COLOR[phase] }}>
            phase: {phase}
            {autoRemainingMs != null && `  ·  auto-stop in ${(autoRemainingMs / 1000).toFixed(1)}s`}
          </p>

          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 14 }}>Notes — what looked off?</h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); logNote(); }
              }}
              placeholder="e.g. 'movement passed even though my hand barely moved' — Ctrl+Enter to log"
              rows={3}
              style={{ width: 320, background: '#222', color: '#eee', padding: 6, fontFamily: 'monospace', fontSize: 12, border: '1px solid #444', borderRadius: 6 }}
            />
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <button onClick={logNote} style={{ padding: '6px 10px' }}>
                Log note ({phase}, frame {frameIdxRef.current[phase === 'idle' ? 'correct' : phase]})
              </button>
              <button onClick={() => downloadNotes(signName, notes)} disabled={notes.length === 0} style={{ padding: '6px 10px' }}>
                Download notes ({notes.length})
              </button>
              <button onClick={() => setNotes([])} disabled={notes.length === 0} style={{ padding: '6px 10px' }}>
                Clear notes
              </button>
            </div>
            {notes.length > 0 && (
              <ul style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', fontSize: 12, paddingLeft: 16 }}>
                {[...notes].reverse().map((n, i) => (
                  <li key={notes.length - i} style={{ marginBottom: 6 }}>
                    <span style={{ color: '#888' }}>
                      [{n.sign} · {n.phase} · frame {n.frameIdx}]
                    </span>{' '}
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ minWidth: 420 }}>
          <h2 style={{ fontSize: 14 }}>Live scores</h2>
          <CalibrationLiveScores
            subscribe={recognition.subscribeResult}
            getSnapshot={recognition.getResultSnapshot}
          />
        </div>
      </div>

      {report && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14 }}>Report</h2>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['parameter', 'required', 'threshold', 'correct (n/med/min/max)', 'confusor (n/med/min/max)', 'flags'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', border: '1px solid #444', padding: '4px 8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.name}>
                  <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{r.name}</td>
                  <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{String(r.required)}</td>
                  <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{r.threshold.toFixed(2)}</td>
                  <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{r.correct}</td>
                  <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{r.confusor}</td>
                  <td style={{ border: '1px solid #444', padding: '4px 8px', color: r.flags.length ? '#e74c3c' : '#666' }}>
                    {r.flags.join('; ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
