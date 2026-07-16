import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Records the learner's own sign attempt from the existing camera MediaStream so they can
 * replay it next to the reference demo (self-review). Strictly in-memory and on-device:
 * the blob lives only in this hook's state as an object URL, is never uploaded anywhere,
 * and is revoked on discard/unmount.
 *
 * A real rolling buffer isn't possible with MediaRecorder — WebM chunks are only playable
 * from the first chunk (codec init segment), so dropping OLD chunks from a single long
 * recording yields an unplayable blob. Instead this restarts a brand-new recording every
 * SEGMENT_MS: each segment is its own complete, independently-playable file, and only the most
 * recent one is kept. The recognition loop runs continuously while the learner retries a sign
 * (there's no discrete "new attempt" event to hook), so without this a single recorder would
 * keep recording across every retry and grow without bound.
 *
 * SEGMENT_MS is now purely a MEMORY SAFETY CAP, not the trim mechanism: ReplayCompare only ever
 * *plays back* the last 5s of whatever segment it's handed (seeking to duration-5), so the segment
 * just needs to be comfortably longer than that window while staying small in memory. 30s balances
 * "always has the full passing attempt" against "never holds minutes of a long retry streak".
 */
const SEGMENT_MS = 30000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4', // Safari
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useAttemptRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const replayUrlRef = useRef<string | null>(null);

  const supported = typeof MediaRecorder !== 'undefined';

  const revokeCurrent = useCallback(() => {
    if (replayUrlRef.current) {
      URL.revokeObjectURL(replayUrlRef.current);
      replayUrlRef.current = null;
    }
    setReplayUrl(null);
  }, []);

  /** Tear down whatever's currently recording without keeping its blob — we're rolling forward. */
  const teardownCurrentRecorder = useCallback(() => {
    const prev = recorderRef.current;
    if (prev && prev.state !== 'inactive') {
      prev.ondataavailable = null;
      prev.onstop = null;
      try { prev.stop(); } catch { /* already stopped */ }
    }
    chunksRef.current = [];
  }, []);

  /** Construct + start a brand-new MediaRecorder on the current stream. */
  const createAndStart = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      console.warn('[QuickSign] MediaRecorder unavailable, replay disabled:', e);
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
  }, []);

  /**
   * Begin one fresh SEGMENT_MS-bounded recording, discarding whatever was recording before.
   * MediaRecorder.stop() is ASYNC — the previous recorder isn't actually done with the stream's
   * tracks the instant .stop() returns. Constructing a second MediaRecorder on the same
   * MediaStream before the first one's 'stop' event fires raced two recorders against the same
   * tracks, which silently produced an empty/broken segment on Chrome — the exact bug that made
   * replay disappear entirely once a prompt ran past the first 4s segment boundary (i.e. almost
   * every real attempt, since reading the prompt before signing easily takes that long). Fix:
   * only construct the new recorder once the old one has actually finished stopping.
   */
  const startSegment = useCallback(() => {
    if (!streamRef.current) return;
    const prev = recorderRef.current;
    if (prev && prev.state !== 'inactive') {
      prev.ondataavailable = null;
      prev.onstop = createAndStart;
      try { prev.stop(); } catch { createAndStart(); }
    } else {
      createAndStart();
    }
  }, [createAndStart]);

  /** Start (or restart) recording an attempt. Discards any previous replay. */
  const start = useCallback((stream: MediaStream) => {
    if (!supported) return;
    revokeCurrent();
    streamRef.current = stream;
    startSegment();
    if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    // Roll to a brand-new segment periodically so a long string of retries on the same sign
    // never leaves more than ~SEGMENT_MS of trailing footage in the recorder.
    segmentTimerRef.current = setInterval(startSegment, SEGMENT_MS);
  }, [supported, revokeCurrent, startSegment]);

  /** Stop recording and expose the CURRENT (at most SEGMENT_MS old) segment as a replay. */
  const stop = useCallback(() => {
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      chunksRef.current = [];
      if (blob.size === 0) return;
      const url = URL.createObjectURL(blob);
      replayUrlRef.current = url;
      setReplayUrl(url);
    };
    try { recorder.stop(); } catch { /* already stopped */ }
  }, []);

  /** Throw away the recording (and any in-flight recorder) without keeping a replay. */
  const discard = useCallback(() => {
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    teardownCurrentRecorder();
    revokeCurrent();
  }, [teardownCurrentRecorder, revokeCurrent]);

  // Hard cleanup on unmount — nothing survives leaving the screen.
  useEffect(() => {
    return () => {
      if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* already stopped */ }
      }
      chunksRef.current = [];
      if (replayUrlRef.current) URL.revokeObjectURL(replayUrlRef.current);
    };
  }, []);

  return { supported, replayUrl, start, stop, discard };
}
