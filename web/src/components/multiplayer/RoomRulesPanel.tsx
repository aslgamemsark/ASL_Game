import type { RoomRules, SignSet } from '@/lib/multiplayerRooms';
import { TURN_SECONDS_OPTIONS } from '@/lib/multiplayerRooms';

interface Props {
  rules: RoomRules;
  onChange: (rules: RoomRules) => void;
  /** Allowed round counts (differs between duel and room). */
  roundsOptions: number[];
  /** Label for the rounds row — e.g. "Rounds" (duel) or "Rounds each" (room). */
  roundsLabel?: string;
}

const SIGN_SETS: { id: SignSet; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'letters', label: 'Letters' },
  { id: 'words', label: 'Words' },
];

// Reusable segmented-control panel for host-set room rules. Shared by DuelPage and RoomPage so the
// two lobbies can't drift. Presentation only — the host owns the RoomRules state and syncs it.
export function RoomRulesPanel({ rules, onChange, roundsOptions, roundsLabel = 'Rounds' }: Props) {
  const row = <T extends string | number>(
    label: string,
    options: { id: T; label: string }[],
    value: T,
    set: (v: T) => void,
  ) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-z-gray-400 shrink-0">{label}</span>
      <div className="flex bg-z-surface/60 rounded-xl p-0.5 gap-0.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            onClick={() => set(o.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              value === o.id ? 'bg-z-purple text-white' : 'text-z-gray-400 hover:text-z-gray-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-z-card border border-white/10 rounded-2xl p-3 flex flex-col gap-2.5">
      <p className="text-[11px] uppercase tracking-widest text-z-gray-500 font-bold">Room rules</p>
      {row(roundsLabel, roundsOptions.map((n) => ({ id: n, label: String(n) })), rules.rounds, (rounds) => onChange({ ...rules, rounds }))}
      {row('Seconds', TURN_SECONDS_OPTIONS.map((n) => ({ id: n, label: `${n}s` })), rules.turnSeconds, (turnSeconds) => onChange({ ...rules, turnSeconds }))}
      {row('Signs', SIGN_SETS, rules.signSet, (signSet) => onChange({ ...rules, signSet }))}
    </div>
  );
}
