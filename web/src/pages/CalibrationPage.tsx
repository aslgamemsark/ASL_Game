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
import { useEffect, useRef, useState, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { SIGNS } from '@/engine/signs';
import { median } from '@/engine/math-utils';
import type { ParamScore } from '@/engine/verifier';

type Phase = 'idle' | 'correct' | 'confusor';

interface LogRow {
  phase: 'correct' | 'confusor';
  frameIdx: number;
  paramName: string;
  score: number;
  threshold: number;
  required: boolean;
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

export function CalibrationPage() {
  const signNames = Object.keys(SIGNS).sort();
  const [signName, setSignName] = useState('COFFEE');
  const sign = SIGNS[signName];

  const { videoRef, status: camStatus, start: startCam } = useCamera();
  const recognition = useRecognition();

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const frameIdxRef = useRef<Record<'correct' | 'confusor', number>>({ correct: 0, confusor: 0 });
  const logRef = useRef<LogRow[]>([]);
  const [logCount, setLogCount] = useState({ correct: 0, confusor: 0 });
  const [report, setReport] = useState<
    { name: string; required: boolean; threshold: number; correct: string; confusor: string; flags: string[] }[]
    | null
  >(null);

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

  // Log every frame's params while a phase is active.
  useEffect(() => {
    const p = phaseRef.current;
    if (p === 'idle' || !recognition.result) return;
    const idx = frameIdxRef.current[p]++;
    for (const param of recognition.result.params) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.result]);

  const togglePhase = useCallback((target: 'correct' | 'confusor') => {
    setPhase((cur) => (cur === target ? 'idle' : target));
    setReport(null);
  }, []);

  const resetLog = useCallback(() => {
    logRef.current = [];
    frameIdxRef.current = { correct: 0, confusor: 0 };
    setLogCount({ correct: 0, confusor: 0 });
    setReport(null);
    setPhase('idle');
  }, []);

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

  const liveParams: ParamScore[] = recognition.result?.params ?? [];

  return (
    <div style={{ fontFamily: 'monospace', background: '#111', color: '#eee', minHeight: '100vh', padding: 16 }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Calibration harness — {signName}</h1>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
        Dev-only (/calibrate). Pick a sign, press "Record CORRECT" and perform it correctly for a
        few seconds, press it again to stop. Then "Record CONFUSOR" and perform the likeliest
        accidental false positive. Press "Build report" to see per-parameter medians against the
        real thresholds, and "Download CSV" to save every raw frame.
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
          </p>
        </div>

        <div style={{ minWidth: 420 }}>
          <h2 style={{ fontSize: 14 }}>Live scores</h2>
          {liveParams.map((p) => {
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
