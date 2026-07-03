import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Local UI preferences — deliberately separate from useUserStore (which syncs progress to
 * Supabase). A sound preference has no reason to round-trip through the server or merge across
 * devices, so it gets its own small persisted store instead of widening UserProgress.
 */
interface SettingsStore {
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundEnabled: true,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    { name: 'asl-game-settings' }
  )
);
