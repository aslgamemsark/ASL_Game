import { motion } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { RoomRulesPanel } from './RoomRulesPanel';
import { RoomVisibilityToggle } from './RoomVisibilityToggle';
import { RoomJoinByCode } from './RoomJoinByCode';
import {
  DUEL_ROUNDS_OPTIONS,
  ROOM_ROUNDS_OPTIONS,
  type RoomRules,
} from '@/lib/multiplayerRooms';

export type LobbyMode = 'duel' | 'room';

interface Props {
  mode: LobbyMode;
  /** Omitted when the mode is fixed by the caller (the challenge-a-friend flow arrives already
   *  committed to a duel), which also hides the switcher — offering a choice that would discard
   *  the invite the user just accepted would be worse than not offering one. */
  onModeChange?: (mode: LobbyMode) => void;
  rules: RoomRules;
  onRulesChange: (rules: RoomRules) => void;
  visibility: 'private' | 'public';
  onVisibilityChange: (visibility: 'private' | 'public') => void;
  onCreate: () => void;
  onSearch: () => void;
  searching: boolean;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onJoin: () => void;
  codeError: string;
}

/** Everything that differs between the two modes, in one place, so a third mode would be a new
 *  entry here rather than a third near-identical lobby. */
const MODES: Record<LobbyMode, {
  label: string; emoji: string; title: string; blurb: string;
  roundsOptions: number[]; roundsLabel?: string; searchLabel: string; inputId: string;
}> = {
  duel: {
    label: '⚔️ 1v1 Duel',
    emoji: '🤟',
    title: 'Sign & Guess',
    blurb: 'Sign it, your friend guesses it.',
    roundsOptions: DUEL_ROUNDS_OPTIONS,
    searchLabel: '🔍 Search for a Match',
    inputId: 'duel-join-code',
  },
  room: {
    label: '👥 Group Room',
    emoji: '👥',
    title: 'Group Sign & Guess',
    blurb: 'Up to 4 players — one signs, everyone else guesses.',
    roundsOptions: ROOM_ROUNDS_OPTIONS,
    roundsLabel: 'Rounds each',
    searchLabel: '🔍 Search for a Room',
    inputId: 'room-join-code',
  },
};

/**
 * The single multiplayer lobby: choose 1v1 or group, set the rules, then create, search or join.
 *
 * Replaces two lobbies that were ~95% the same markup behind a separate "pick a mode" screen. That
 * split cost a tap before anyone could do anything, and meant every lobby change had to be made
 * twice — the private/public toggle and the join-code input had already drifted into verbatim
 * duplicates once and been extracted (2026-07-31); this removes the rest of the copy.
 *
 * Presentation only. The two modes still run different game engines behind this, so the caller
 * owns create/join/search and the signaling that goes with them.
 */
export function MultiplayerLobby({
  mode, onModeChange, rules, onRulesChange, visibility, onVisibilityChange,
  onCreate, onSearch, searching, joinCode, onJoinCodeChange, onJoin, codeError,
}: Props) {
  const m = MODES[mode];

  return (
    <motion.div
      key="lobby"
      className="flex-1 flex flex-col items-center justify-center gap-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {onModeChange && (
        <div className="w-full max-w-xs flex bg-z-card border border-white/10 rounded-2xl p-1" role="group" aria-label="Game mode">
          {(Object.keys(MODES) as LobbyMode[]).map((id) => (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              aria-pressed={mode === id}
              className={`flex-1 py-3.5 rounded-xl text-xs font-bold transition-colors ${
                mode === id ? 'bg-z-purple text-white' : 'text-z-gray-400'
              }`}
            >
              {MODES[id].label}
            </button>
          ))}
        </div>
      )}

      <div className="text-6xl" aria-hidden="true">{m.emoji}</div>
      <div className="text-center">
        <h2 className="text-2xl font-bold">{m.title}</h2>
        <p className="text-z-gray-300 text-sm mt-1">{m.blurb}</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2">
        <RoomRulesPanel
          rules={rules}
          onChange={onRulesChange}
          roundsOptions={m.roundsOptions}
          roundsLabel={m.roundsLabel}
        />
        <RoomVisibilityToggle visibility={visibility} onChange={onVisibilityChange} />
        <Button onClick={onCreate} fullWidth>Create Room</Button>
      </div>

      <motion.button
        onClick={onSearch}
        disabled={searching}
        className="w-full max-w-xs py-3 rounded-2xl font-bold text-sm bg-z-card border border-white/10 hover:border-z-purple/40 disabled:opacity-50"
        whileTap={{ scale: 0.97 }}
      >
        {searching ? 'Searching…' : m.searchLabel}
      </motion.button>
      {codeError && <p className="text-center text-z-red text-xs -mt-3">{codeError}</p>}

      <RoomJoinByCode
        id={m.inputId}
        value={joinCode}
        onChange={onJoinCodeChange}
        onJoin={onJoin}
      />
    </motion.div>
  );
}
