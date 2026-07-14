import { useEffect, useRef } from 'react';

interface Props {
  stream: MediaStream | null;
  label: string;
  connected: boolean;
}

/**
 * Renders another player's live WebRTC video feed. Deliberately never mirrored — unlike the
 * local WebcamMirror, flipping an opponent's video would visually reverse their sign and confuse
 * the guesser, so this stays a separate component rather than a `source` flag on WebcamMirror.
 */
export function RemotePeerVideo({ stream, label, connected }: Props) {
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
    <div className="relative rounded-2xl overflow-hidden bg-z-surface aspect-video">
      <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />
      {!(connected && stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-z-surface/90">
          <p className="text-xs text-z-gray-400">Connecting…</p>
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded-md">{label}</span>
    </div>
  );
}
