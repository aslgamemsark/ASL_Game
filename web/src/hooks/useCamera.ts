import { useRef, useState, useCallback, useEffect } from 'react';
import { track, isKillSwitchOn, type ScreenName } from '@/analytics';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

/** `screen` is optional and purely for analytics labeling — every recognition-driven page passes
 *  its own screen name so camera_permission_* events say which screen asked. Defaults to
 *  'onboarding' since that's the only remaining caller (CalibrationPage, a dev-only tool) that
 *  doesn't pass one. */
export function useCamera(screen: ScreenName = 'onboarding') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');

  const attachStream = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, []);

  // Returns the resulting status — React state updates don't apply within the same synchronous
  // tick, so a caller that needs to branch on the outcome right after `await start()` (e.g.
  // PracticePage deciding whether to show the one-time hand check) can't rely on reading the
  // `status` state variable immediately afterward; the return value is the reliable signal.
  const start = useCallback(async (): Promise<CameraStatus> => {
    if (streamRef.current) {
      attachStream();
      setStatus('active');
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
      attachStream();
      setStatus('active');
      track('camera_permission_granted', { screen });
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
  }, [attachStream, screen]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (status === 'active') {
      attachStream();
    }
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Live stream accessor for consumers that need the raw MediaStream (e.g. the attempt
  // recorder). A getter (not the ref) so callers can't mutate/stop tracks we own.
  const getStream = useCallback(() => streamRef.current, []);

  return { videoRef, status, start, stop, getStream };
}
