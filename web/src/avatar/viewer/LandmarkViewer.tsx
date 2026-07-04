/**
 * AvatarLab: Landmark Viewer (spec Ch.4 "Debug Viewer Requirements" — play, pause, frame slider,
 * current frame, coordinates, confidence [N/A for this dataset — see LandmarkLoader.ts], missing
 * landmark highlight, left/right toggle).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadClip, validateClip } from '../retarget/LandmarkLoader.ts';
import type { LoadedClip, RawLandmarkClip } from '../retarget/landmarkTypes.ts';

const AVAILABLE_SIGNS = ['COFFEE', 'THANK_YOU', 'HELLO'] as const;

// MediaPipe hand topology — which point indices connect to draw the finger skeleton.
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [0, 9], [9, 10], [10, 11], [11, 12], // middle
  [0, 13], [13, 14], [14, 15], [15, 16], // ring
  [0, 17], [17, 18], [18, 19], [19, 20], // pinky
  [5, 9], [9, 13], [13, 17], // knuckle line
];

export function LandmarkViewer() {
  const [sign, setSign] = useState<(typeof AVAILABLE_SIGNS)[number]>('COFFEE');
  const [clip, setClip] = useState<LoadedClip | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setClip(null);
    setFrameIdx(0);
    fetch(`/dev/landmarks/${sign}.json`)
      .then((r) => r.json())
      .then((raw: RawLandmarkClip) => setClip(loadClip(raw, `/dev/landmarks/${sign}.json`)));
  }, [sign]);

  const validation = useMemo(() => (clip ? validateClip(clip) : null), [clip]);

  useEffect(() => {
    if (!playing || !clip) return;
    const id = setInterval(() => {
      setFrameIdx((i) => (i + 1) % clip.frames.length);
    }, 1000 / Math.max(clip.estimatedFps, 5));
    return () => clearInterval(id);
  }, [playing, clip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frame = clip.frames[frameIdx];
    const scaleX = canvas.width / frame.width;
    const scaleY = canvas.height / frame.height;

    ctx.fillStyle = '#0f131a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // shoulders + mouth reference points
    ctx.fillStyle = '#5c6470';
    for (const p of [frame.leftShoulder, frame.rightShoulder, frame.mouth]) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p[0] * scaleX, p[1] * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const side of ['left', 'right'] as const) {
      const hand = frame.hands[side];
      if (!hand) continue;
      ctx.strokeStyle = side === 'left' ? '#4dd0e1' : '#ffb74d';
      ctx.fillStyle = side === 'left' ? '#4dd0e1' : '#ffb74d';
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = hand.points[a];
        const pb = hand.points[b];
        ctx.beginPath();
        ctx.moveTo(pa[0] * scaleX, pa[1] * scaleY);
        ctx.lineTo(pb[0] * scaleX, pb[1] * scaleY);
        ctx.stroke();
      }
      hand.points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p[0] * scaleX, p[1] * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (!frame.hands.left && !frame.hands.right) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '14px monospace';
      ctx.fillText('NO HAND DETECTED THIS FRAME', 12, 24);
    }
  }, [clip, frameIdx]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#d7dde8', fontFamily: 'monospace', fontSize: 13, padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <select value={sign} onChange={(e) => setSign(e.target.value as typeof sign)}>
          {AVAILABLE_SIGNS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        {clip && (
          <span>
            frame {frameIdx + 1}/{clip.frames.length} · t={clip.frames[frameIdx].t.toFixed(3)}s · ~{clip.estimatedFps.toFixed(1)}fps
          </span>
        )}
      </div>
      {clip && (
        <input
          type="range"
          min={0}
          max={clip.frames.length - 1}
          value={frameIdx}
          onChange={(e) => setFrameIdx(Number(e.target.value))}
          style={{ marginBottom: 8 }}
        />
      )}
      <canvas ref={canvasRef} width={640} height={480} style={{ background: '#0f131a', border: '1px solid #2a2f3a' }} />
      {validation && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div>
            hand coverage: {validation.framesWithAnyHand}/{validation.frameCount} any-hand, {validation.framesWithBothHands}/
            {validation.frameCount} both-hands · missing pose: {validation.framesWithMissingPose}/{validation.frameCount}
          </div>
          <div>tracking snaps flagged: {validation.possibleTrackingSnaps.length} · malformed frames: {validation.malformedFrames.length}</div>
          <div style={{ color: validation.pass ? '#69db7c' : '#ff6b6b' }}>validation: {validation.pass ? 'PASS' : 'FAIL'}</div>
        </div>
      )}
    </div>
  );
}
