import { useRef, useState, useCallback, useEffect } from 'react';
import { track, isKillSwitchOn, type ScreenName } from '@/analytics';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'stalled';

// How long to wait, after a stream is granted, for the video element to actually produce a frame
// before treating it as stalled. Found via a real PostHog session: getUserMedia() resolved and
// camera_permission_granted fired, but the video element never advanced past readyState 0 and the
// user sat looking at a blank feed with no error and no retry option — see camera_stalled below.
const STALL_TIMEOUT_MS = 6000;

/** `screen` is optional and purely for analytics labeling — every recognition-driven page passes
 *  its own screen name so camera_permission_* events say which screen asked. Defaults to
 *  'onboarding' since that's the only remaining caller (CalibrationPage, a dev-only tool) that
 *  doesn't pass one. */
export function useCamera(screen: ScreenName = 'onboarding') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current !== null) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  // getUserMedia() resolving is not proof the feed actually works — a granted stream can still
  // never produce a frame (autoplay policy, a dead virtual camera, etc.), which the play().catch
  // below alone can't detect since it only sees the promise, not whether frames follow. Give it
  // STALL_TIMEOUT_MS to prove itself; if no frame has landed by then, treat it as failed so the UI
  // can show the same retry affordance it already shows for a denied/errored camera.
  const scheduleStallCheck = useCallback(() => {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => {
      if (videoRef.current && videoRef.current.readyState < 2) {
        setStatus('stalled');
        track('camera_stalled', { screen, reason: 'no_frame' });
      }
    }, STALL_TIMEOUT_MS);
  }, [clearStallTimer, screen]);

  const attachStream = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      // A play() rejection (autoplay policy, element removed mid-attach, etc.) must not vanish
      // silently — log it even though scheduleStallCheck is what actually flips the visible status,
      // since a rejection here is one plausible cause of the frame never arriving.
      video.play().catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : 'unknown';
        track('camera_error', { screen, error_name: `play_failed:${name}` });
      });
    }
  }, [screen]);

  // Returns the resulting status — React state updates don't apply within the same synchronous
  // tick, so a caller that needs to branch on the outcome right after `await start()` (e.g.
  // PracticePage deciding whether to show the one-time hand check) can't rely on reading the
  // `status` state variable immediately afterward; the return value is the reliable signal.
  const start = useCallback(async (): Promise<CameraStatus> => {
    if (streamRef.current) {
      attachStream();
      setStatus('active');
      scheduleStallCheck();
      return 'active';
    }
    // Emergency remote kill switch (PostHog flag `disable_camera`) — lets camera-based practice be
    // disabled instantly if it breaks under real launch load, without a hotfix deploy. Surfaces as
    // the same 'error' status the UI already handles for a genuine getUserMedia failure.
    if (isKillSwitchOn('disable_camera')) {
      setStatus('error');
      return 'error';
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      // A track can end on its own later (device unplugged, OS revokes access mid-session) with no
      // exception anywhere in this hook — without this listener that death is invisible until the
      // caller notices the feed froze.
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          setStatus('stalled');
          track('camera_stalled', { screen, reason: 'track_ended' });
        };
      });
      attachStream();
      setStatus('active');
      track('camera_permission_granted', { screen });
      scheduleStallCheck();
      return 'active';
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError') {
        setStatus('denied');
        track('camera_permission_denied', { screen });
        return 'denied';
      } else {
        setStatus('error');
        track('camera_error', { screen, error_name: name || 'unknown' });
        return 'error';
      }
    }
  }, [attachStream, scheduleStallCheck, screen]);

  const stop = useCallback(() => {
    clearStallTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, [clearStallTimer]);

  useEffect(() => {
    if (status === 'active') {
      attachStream();
    }
  });

  useEffect(() => {
    return () => {
      clearStallTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [clearStallTimer]);

  // Live stream accessor for consumers that need the raw MediaStream (e.g. the attempt
  // recorder). A getter (not the ref) so callers can't mutate/stop tracks we own.
  const getStream = useCallback(() => streamRef.current, []);

  return { videoRef, status, start, stop, getStream };
}
