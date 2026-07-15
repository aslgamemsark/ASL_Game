import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <AnimatePresence>
          <motion.button
            key="duel"
            onClick={() => setActive('duel')}
            className="w-full text-left bg-z-card border border-white/8 hover:border-z-purple/40 rounded-2xl p-5 flex items-center gap-4 transition-colors"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl">⚔️</span>
            <div>
              <p className="font-bold text-lg">1v1 Duel</p>
              <p className="text-z-gray-400 text-sm mt-0.5">Challenge one friend — sign it, they guess it.</p>
            </div>
          </motion.button>

          <motion.button
            key="room"
            onClick={() => setActive('room')}
            className="w-full text-left bg-z-card border border-white/8 hover:border-z-purple/40 rounded-2xl p-5 flex items-center gap-4 transition-colors"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl">👥</span>
            <div>
              <p className="font-bold text-lg">Group Room</p>
              <p className="text-z-gray-400 text-sm mt-0.5">Up to 4 players — everyone takes a turn signing.</p>
            </div>
          </motion.button>
        </AnimatePresence>
      </div>
    </div>
  );
}
