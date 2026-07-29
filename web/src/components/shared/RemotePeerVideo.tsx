import { useEffect, useRef, useState } from 'react';
import { TurnOverlay } from '@/components/shared/TurnOverlay';

interface Props {
  stream: MediaStream | null;
  label: string;
  connected: boolean;
  /** Pre-resolved Tailwind classes for the PEER's equipped shop border, so you see their cosmetic
   *  the same way they see yours — resolved by the caller via getShopItem(peerBorder)?.preview,
   *  matching WebcamMirror. Applied on the ring/shadow layer. */
  cosmeticBorderClasses?: string;
  /** Multiplayer turn indicator: true when this peer is the active signer — colored outline +
   *  label chip + depleting timer bar, matching WebcamMirror's own-turn indicator. */
  activeTurn?: boolean;
  turnLabel?: string;
  timerPercent?: number;
  /** Fires once this specific <video> element actually renders a frame — the real "I can see
   *  them" signal, as opposed to `connected` (WebRTC connectionState + stream presence), which
   *  can be true for a beat before any pixel has actually decoded. Callers use this to gate the
   *  turn timer's start on the GUESSER genuinely being able to see the signer, not just on the
   *  connection reaching 'connected'. Fires again on every mount (rounds remount this component
   *  as roles swap), matching the existing stream re-attach behavior below. */
  onVideoReady?: () => void;
}

/**
 * Renders another player's live WebRTC video feed. Deliberately never mirrored — unlike the
 * local WebcamMirror, flipping an opponent's video would visually reverse their sign and confuse
 * the guesser, so this stays a separate component rather than a `source` flag on WebcamMirror.
 */
export function RemotePeerVideo({ stream, label, connected, cosmeticBorderClasses, activeTurn, turnLabel, timerPercent, onVideoReady }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  // Same portrait-crop bug as WebcamMirror: a hardcoded 16:9 box crops a portrait peer stream
  // top-and-bottom. Read from the video element's own dimensions once metadata loads, rather than
  // the canvas-per-frame approach WebcamMirror uses (this is a plain <video>, not canvas-drawn).
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const updateAspect = () => {
    const v = ref.current;
    if (v?.videoWidth && v.videoHeight) setAspectRatio(v.videoWidth / v.videoHeight);
  };
  // Attach on every mount + whenever the stream changes. Callers may remount this element as
  // roles/rounds swap, so re-attaching here (not once in ontrack) keeps video flowing.
  useEffect(() => {
    const v = ref.current;
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div style={{ aspectRatio: aspectRatio ?? 16 / 9 }} className={`relative rounded-2xl overflow-hidden bg-z-surface ${cosmeticBorderClasses ?? ''} ${activeTurn ? 'outline outline-2 outline-z-purple-light' : ''}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onLoadedData={onVideoReady}
        onLoadedMetadata={updateAspect}
        onResize={updateAspect}
      />
      {!(connected && stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-z-surface/90">
          <p className="text-xs text-z-gray-400">Connecting…</p>
        </div>
      )}
      <TurnOverlay active={!!activeTurn} label={turnLabel} timerPercent={timerPercent} />
      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-video-plate text-white px-1.5 py-0.5 rounded-md">{label}</span>
    </div>
  );
}
