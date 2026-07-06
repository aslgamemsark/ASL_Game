import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  vibrationEnabled: boolean;
  toggleVibration: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      vibrationEnabled: true,
      toggleVibration: () => set((s) => ({ vibrationEnabled: !s.vibrationEnabled })),
    }),
    {
      name: 'asl-game-settings',
      // Migrate from old soundEnabled key
      migrate: (persisted: unknown) => {
        const s = persisted as Record<string, unknown>;
        if ('soundEnabled' in s && !('vibrationEnabled' in s)) {
          return { vibrationEnabled: s.soundEnabled as boolean };
        }
        return s as SettingsStore;
      },
      version: 1,
    }
  )
);
