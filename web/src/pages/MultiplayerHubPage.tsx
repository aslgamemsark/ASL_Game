import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { DuelPage } from '@/pages/DuelPage';
import { RoomPage } from '@/pages/RoomPage';

type Mode = 'hub' | 'duel' | 'room';

interface Props {
  onExit: () => void;
  /** Pre-selected mode — skips the hub screen entirely (challenge-friend / "Start 1v1" flows). */
  mode?: 'duel' | 'room';
  autoHostRoomId?: string;
  autoJoinCode?: string;
  onRequireSignIn?: () => void;
}

export function MultiplayerHubPage({ onExit, mode, autoHostRoomId, autoJoinCode, onRequireSignIn }: Props) {
  const { user } = useAuth();
  const [active, setActive] = useState<Mode>(mode ?? 'hub');

  // Guest gate BEFORE the mode branches below, so a guest can never reach DuelPage/RoomPage (and
  // therefore never see or use the room-code input) even via the challenge-friend auto-host/join
  // props — multiplayer requires an account (progress, cosmetics, and the friend graph itself all
  // key off a real user id).
  if (!user) {
    return (
      <div className="min-h-screen bg-z-bg flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
          <HeaderBackButton icon="close" onClick={onExit} />
          <h1 className="font-bold text-lg">Multiplayer</h1>
        </div>
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col items-center justify-center gap-4 text-center">
          <span className="text-5xl">🔒</span>
          <div>
            <p className="font-bold text-lg">Sign in to play</p>
            <p className="text-z-gray-400 text-sm mt-1">Multiplayer needs an account so your friends can find you and your wins count.</p>
          </div>
          <motion.button
            onClick={onRequireSignIn}
            className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-primary"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          >
            Sign In
          </motion.button>
        </div>
      </div>
    );
  }

  if (active === 'duel') {
    return <DuelPage onExit={onExit} autoHostRoomId={autoHostRoomId} autoJoinCode={autoJoinCode} />;
  }
  if (active === 'room') {
    return <RoomPage onExit={onExit} />;
  }

  return (
    <div className="min-h-screen bg-z-bg flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton icon="close" onClick={onExit} />
        <h1 className="font-bold text-lg">Multiplayer</h1>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col justify-center gap-4">
        {[
          { key: 'duel' as const, icon: '⚔️', title: '1v1 Duel', desc: 'Challenge one friend — sign it, they guess it.' },
          { key: 'room' as const, icon: '👥', title: 'Group Room', desc: 'Up to 4 players — everyone takes a turn signing.' },
        ].map((m, i) => (
          <motion.button
            key={m.key}
            onClick={() => setActive(m.key)}
            className="group w-full text-left bg-z-card rounded-3xl p-5 flex items-center gap-4 ring-1 ring-inset ring-z-purple-deep/50 transition-all duration-200 hover:ring-z-purple/50 hover:bg-z-surface/50"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-z-purple/15 text-3xl ring-1 ring-inset ring-z-purple/30 transition-transform duration-200 group-hover:scale-105">
              {m.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-lg">{m.title}</p>
              <p className="text-z-gray-400 text-sm mt-0.5">{m.desc}</p>
            </div>
            <span className="text-z-gray-500 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-z-purple-light" aria-hidden>→</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
