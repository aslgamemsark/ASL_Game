import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Records the learner's own sign attempt from the existing camera MediaStream so they can
 * replay it next to the reference demo (self-review). Strictly in-memory and on-device:
 * the blob lives only in this hook's state as an object URL, is never uploaded anywhere,
 * and is revoked on discard/unmount.
 *
 * A real rolling buffer isn't possible with MediaRecorder — WebM chunks are only playable
 * from the first chunk (codec init segment), so dropping OLD chunks from a single long
 * recording yields an unplayable blob. Instead this restarts a brand-new short recording
 * every SEGMENT_MS: each segment is its own complete, independently-playable file, and only
 * the most recent one is kept. The recognition loop runs continuously while the learner
 * retries a sign (there's no discrete "new attempt" event to hook), so without this a single
 * recorder just keeps recording across every retry — by the time you finally pass on try #4,
 * the "replay" would be the whole multi-attempt session, not the ~3-4s that actually passed.
 */
const SEGMENT_MS = 4000;

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

  /** Begin one fresh SEGMENT_MS-bounded recording, discarding whatever was recording before. */
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    teardownCurrentRecorder();
    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      console.warn('[SignUp] MediaRecorder unavailable, replay disabled:', e);
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
  }, [teardownCurrentRecorder]);

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
