import { motion } from 'framer-motion';

interface Props {
  /** Unique id for the input/label pair — DuelPage and RoomPage each pass their own. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  onJoin: () => void;
}

// Join-by-code input shared by DuelPage and RoomPage so the two lobbies can't drift. py-3 (not the
// original py-2.5) so the Join button clears the 44px touch-target minimum (Phase 3 audit).
export function RoomJoinByCode({ id, value, onChange, onJoin }: Props) {
  return (
    <div className="w-full max-w-xs">
      <p className="text-center text-z-gray-400 text-sm mb-2">— or join with a code —</p>
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">Room code</label>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="XXXXXX"
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 bg-z-card border border-white/10 rounded-2xl px-4 py-3 text-sm uppercase tracking-widest font-bold text-center focus:border-z-purple/60"
        />
        <motion.button
          onClick={onJoin}
          disabled={!value.trim()}
          className="px-4 py-3 bg-z-purple rounded-2xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          whileTap={{ scale: 0.96 }}
        >
          Join
        </motion.button>
      </div>
    </div>
  );
}
