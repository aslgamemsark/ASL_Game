import { useEffect, useRef } from 'react';
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
    <div className={`relative rounded-2xl overflow-hidden bg-z-surface aspect-video ${cosmeticBorderClasses ?? ''} ${activeTurn ? 'outline outline-2 outline-z-purple-light' : ''}`}>
      <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" onLoadedData={onVideoReady} />
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
