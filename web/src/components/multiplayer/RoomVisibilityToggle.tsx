interface Props {
  visibility: 'private' | 'public';
  onChange: (visibility: 'private' | 'public') => void;
}

// Private/public segmented control shared by DuelPage and RoomPage so the two lobbies can't drift.
// py-3.5 (not the original py-1.5) so each half clears the 44px touch-target minimum — the original
// was ~28px tall, found during the Phase 3 audit alongside RoomJoinByCode's Join button.
export function RoomVisibilityToggle({ visibility, onChange }: Props) {
  return (
    <div className="flex bg-z-card border border-white/10 rounded-2xl p-1">
      <button
        onClick={() => onChange('private')}
        aria-pressed={visibility === 'private'}
        className={`flex-1 py-3.5 rounded-xl text-xs font-bold transition-colors ${visibility === 'private' ? 'bg-z-purple text-white' : 'text-z-gray-400'}`}
      >
        🔒 Private
      </button>
      <button
        onClick={() => onChange('public')}
        aria-pressed={visibility === 'public'}
        className={`flex-1 py-3.5 rounded-xl text-xs font-bold transition-colors ${visibility === 'public' ? 'bg-z-purple text-white' : 'text-z-gray-400'}`}
      >
        🌐 Public
      </button>
    </div>
  );
}
