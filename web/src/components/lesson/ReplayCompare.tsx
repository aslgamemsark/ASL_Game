import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';
import { ClipEnlarge } from '@/components/lesson/ClipEnlarge';
import { Button } from '@/components/shared/Button';
import type { ParamScore } from '@/engine/verifier';
import type { Sign } from '@/engine/schema';

interface Props {
  /** Object URL of the learner's just-recorded attempt (in-memory only, never uploaded). */
  attemptUrl: string;
  /** Reference demo clip, when this sign has one — shown side by side with the attempt. */
  clipUrl?: string;
  signName: string;
  hint?: string;
  /** Final verifier scores from the passing attempt — recap shown when there's no reference clip. */
  params?: ParamScore[] | null;
  sign?: Sign | null;
  onContinue: () => void;
}

/** How much of the tail of the attempt recording to actually show. A retry streak can leave a
 *  segment many seconds long; the part that matters is the passing attempt at the very end, so we
 *  play only the last PLAYBACK_WINDOW_S seconds and loop within that window. */
const PLAYBACK_WINDOW_S = 5;

/**
 * Post-pass self-review: replay the learner's own attempt, beside the reference demo when one
 * exists. The attempt video is mirrored (scaleX(-1)) so it matches what the learner saw in the
 * live webcam mirror while signing. Slow-mo toggle drives playbackRate on both videos so the
 * comparison stays in step. The attempt is trimmed to its last PLAYBACK_WINDOW_S seconds at
 * playback time (looping within that window) so a long multi-retry recording still shows just the
 * successful attempt.
 */
export function ReplayCompare({ attemptUrl, clipUrl, signName, hint, params, sign, onContinue }: Props) {
  const attemptRef = useRef<HTMLVideoElement>(null);
  const referenceRef = useRef<HTMLVideoElement>(null);
  const [slowMo, setSlowMo] = useState(false);
  const [referenceEnlarged, setReferenceEnlarged] = useState(false);

  useEffect(() => {
    const rate = slowMo ? 0.5 : 1;
    if (attemptRef.current) attemptRef.current.playbackRate = rate;
    if (referenceRef.current) referenceRef.current.playbackRate = rate;
  }, [slowMo]);

  // Trim the attempt to its last PLAYBACK_WINDOW_S seconds. MediaRecorder WebM blobs frequently
  // report duration === Infinity until forced, so if we don't get a finite duration up front we
  // seek far past the end (a well-known workaround) to make the browser compute the real duration,
  // then read it back in 'durationchange'. Once known, we seek to (duration - window) and re-seek
  // there whenever playback reaches the end — the native `loop` attribute is intentionally omitted
  // on this video so 'ended' fires and we can loop to the window start instead of to 0.
  useEffect(() => {
    const v = attemptRef.current;
    if (!v) return;
    let windowStart = 0;
    let forcingDuration = false;

    const applyWindow = (duration: number) => {
      windowStart = Number.isFinite(duration) && duration > PLAYBACK_WINDOW_S ? duration - PLAYBACK_WINDOW_S : 0;
      try { v.currentTime = windowStart; } catch { /* not seekable yet */ }
      void v.play().catch(() => {});
    };
    const onLoaded = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) applyWindow(v.duration);
      else { forcingDuration = true; try { v.currentTime = 1e7; } catch { /* ignore */ } }
    };
    const onDurationChange = () => {
      if (forcingDuration && Number.isFinite(v.duration) && v.duration > 0) {
        forcingDuration = false;
        applyWindow(v.duration);
      }
    };
    const onTimeUpdate = () => {
      if (!forcingDuration && Number.isFinite(v.duration) && v.currentTime >= v.duration - 0.08) {
        v.currentTime = windowStart;
      }
    };
    const onEnded = () => { v.currentTime = windowStart; void v.play().catch(() => {}); };

    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);
    if (v.readyState >= 1) onLoaded();

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);
    };
  }, [attemptUrl]);

  const sideBySide = Boolean(clipUrl);

  return (
    <motion.div
      className="flex-1 flex flex-col gap-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center">
        <p className="text-sm text-z-gray-400 uppercase tracking-widest">Your replay</p>
        <h2 className="text-2xl font-bold mt-1">{signName.replace(/_/g, ' ')}</h2>
      </div>

      <div className={sideBySide ? 'grid grid-cols-2 gap-3' : ''}>
        <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-[4/3]">
          {/* No `loop` here on purpose — the effect above loops manually within the last-5s window
              via the 'ended' handler. */}
          <video
            ref={attemptRef}
            src={attemptUrl}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-contain"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
            <p className="text-white text-xs font-bold">You</p>
          </div>
        </div>

        {sideBySide && (
          <button
            type="button"
            onClick={() => setReferenceEnlarged(true)}
            aria-label="Enlarge reference clip"
            className="relative rounded-2xl overflow-hidden bg-z-surface aspect-[4/3] cursor-zoom-in"
          >
            <video
              ref={referenceRef}
              src={clipUrl}
              loop
              muted
              playsInline
              autoPlay
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <p className="text-white text-xs font-bold">Reference</p>
            </div>
          </button>
        )}
      </div>

      {sideBySide && clipUrl && (
        <ClipEnlarge
          clipUrl={clipUrl}
          signName={signName}
          open={referenceEnlarged}
          onClose={() => setReferenceEnlarged(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-2xs text-z-gray-400">
          Replay stays on your device and is deleted when you continue.
        </p>
        <button
          onClick={() => setSlowMo((s) => !s)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            slowMo
              ? 'border-z-purple-light text-z-purple-light'
              : 'border-z-gray-500/30 text-z-gray-400 hover:text-z-gray-200'
          }`}
          aria-pressed={slowMo}
        >
          🐢 Slow-mo {slowMo ? 'on' : 'off'}
        </button>
      </div>

      {!sideBySide && (
        <>
          {hint && (
            <p className="text-sm text-z-gray-300 text-center italic">{hint}</p>
          )}
          {params && params.length > 0 && (
            <ParameterChecklist params={params} sign={sign} />
          )}
        </>
      )}

      <Button onClick={onContinue} fullWidth className="mt-auto">
        Continue
      </Button>
    </motion.div>
  );
}
