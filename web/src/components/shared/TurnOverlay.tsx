/**
 * The multiplayer per-turn overlay drawn on the active signer's video feed: a label chip
 * ("YOUR TURN" / "{name}'s turn") plus a depleting turn-timer bar. Shared by WebcamMirror and
 * RemotePeerVideo so the two feeds render an identical indicator (the components themselves stay
 * separate because one mirrors the local camera and one doesn't).
 *
 * Renders nothing unless `active`. The colored active outline lives on each parent container (via
 * an `outline` utility — a distinct layer from the cosmetic ring border and the pass border, so
 * all three coexist); this component only draws the label + timer inside the frame.
 */
interface Props {
  active: boolean;
  label?: string;
  /** 0-100 remaining fraction of the current turn. */
  timerPercent?: number;
}

export function TurnOverlay({ active, label, timerPercent }: Props) {
  if (!active) return null;
  const pct = Math.max(0, Math.min(100, timerPercent ?? 0));
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/40 z-20">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%`, background: pct < 30 ? '#EF4444' : '#A78BFA' }}
        />
      </div>
      {label && (
        <span className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 text-[11px] font-bold text-white bg-z-purple/85 px-2.5 py-0.5 rounded-full whitespace-nowrap">
          {label}
        </span>
      )}
    </>
  );
}
