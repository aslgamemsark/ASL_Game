import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { DuelPage } from '@/pages/DuelPage';
import { Button } from '@/components/shared/Button';
import { RoomPage } from '@/pages/RoomPage';
import { useFeatureFlag } from '@/analytics';

type Mode = 'duel' | 'room';

interface Props {
  onExit: () => void;
  /** Pins the mode and hides the in-lobby switcher (challenge-friend / "Start 1v1" flows). */
  mode?: 'duel' | 'room';
  autoHostRoomId?: string;
  autoJoinCode?: string;
  onRequireSignIn?: () => void;
}

export function MultiplayerHubPage({ onExit, mode, autoHostRoomId, autoJoinCode, onRequireSignIn }: Props) {
  const { user } = useAuth();
  // No separate "pick a mode" screen any more: the lobby itself carries the 1v1 / Group
  // switcher, so multiplayer opens straight into a usable room rather than costing a tap
  // first. `mode` (challenge flows) still pins it and hides the switcher.
  const [active, setActive] = useState<Mode>(mode ?? 'duel');
  // Emergency remote kill switch — WebRTC/Realtime bugs under real concurrent load are exactly the
  // class of thing worth disabling instantly rather than waiting on a hotfix deploy.
  const multiplayerDisabled = useFeatureFlag('disable_multiplayer', false);

  if (multiplayerDisabled) {
    return (
      <div className="min-h-dvh bg-z-bg flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
          <HeaderBackButton icon="close" onClick={onExit} />
          <h1 className="font-bold text-lg">Multiplayer</h1>
        </div>
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto">
          <span className="text-5xl">🛠️</span>
          <p className="font-bold text-lg">Multiplayer is briefly offline</p>
          <p className="text-z-gray-400 text-sm">We're fixing something — check back in a bit.</p>
        </div>
      </div>
    );
  }

  // Guest gate BEFORE the mode branches below, so a guest can never reach DuelPage/RoomPage (and
  // therefore never see or use the room-code input) even via the challenge-friend auto-host/join
  // props — multiplayer requires an account (progress, cosmetics, and the friend graph itself all
  // key off a real user id).
  if (!user) {
    return (
      <div className="min-h-dvh bg-z-bg flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
          <HeaderBackButton icon="close" onClick={onExit} />
          <h1 className="font-bold text-lg">Multiplayer</h1>
        </div>
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto">
          <span className="text-5xl">🔒</span>
          <div>
            <p className="font-bold text-lg">Sign in to play</p>
            <p className="text-z-gray-400 text-sm mt-1">Multiplayer needs an account so your friends can find you and your wins count.</p>
          </div>
          <Button onClick={onRequireSignIn}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // `mode` pinned by the caller means the user arrived committed (challenge-a-friend); offering a
  // switcher there would discard the invite they just accepted.
  const switchMode = mode ? undefined : setActive;

  if (active === 'duel') {
    return (
      <DuelPage
        onExit={onExit}
        autoHostRoomId={autoHostRoomId}
        autoJoinCode={autoJoinCode}
        onSwitchMode={switchMode}
      />
    );
  }
  return <RoomPage onExit={onExit} onSwitchMode={switchMode} />;

}
