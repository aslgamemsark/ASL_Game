import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Records the learner's own sign attempt from the existing camera MediaStream so they can
 * replay it next to the reference demo (self-review). Strictly in-memory and on-device:
 * the blob lives only in this hook's state as an object URL, is never uploaded anywhere,
 * and is revoked on discard/unmount. Recording the WHOLE attempt (rather than a rolling
 * last-N-seconds buffer) is deliberate — WebM chunks are only playable from the first chunk
 * (codec init segment), so dropping old chunks would yield an unplayable blob. Attempts are
 * seconds long at 640x480, so memory is a non-issue.
 */

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

  /** Start (or restart) recording an attempt. Discards any previous replay. */
  const start = useCallback((stream: MediaStream) => {
    if (!supported) return;
    // Tear down any in-flight recorder without producing a replay.
    const prev = recorderRef.current;
    if (prev && prev.state !== 'inactive') {
      prev.ondataavailable = null;
      prev.onstop = null;
      try { prev.stop(); } catch { /* already stopped */ }
    }
    revokeCurrent();
    chunksRef.current = [];

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
  }, [supported, revokeCurrent]);

  /** Stop recording and expose the finished attempt as a playable object URL. */
  const stop = useCallback(() => {
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
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    chunksRef.current = [];
    revokeCurrent();
  }, [revokeCurrent]);

  // Hard cleanup on unmount — nothing survives leaving the screen.
  useEffect(() => {
    return () => {
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
