import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  vibrationEnabled: boolean;
  toggleVibration: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  /** Speaks the sign's English name aloud on a successful attempt (see lib/speak.ts). Separate
   *  from soundEnabled, which gates game SFX — muting effects isn't a request to mute the word
   *  being taught. */
  speechEnabled: boolean;
  toggleSpeech: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      vibrationEnabled: true,
      toggleVibration: () => set((s) => ({ vibrationEnabled: !s.vibrationEnabled })),
      soundEnabled: true,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      speechEnabled: true,
      toggleSpeech: () => set((s) => ({ speechEnabled: !s.speechEnabled })),
    }),
    {
      name: 'asl-game-settings',
      // Migrate from old soundEnabled key
      migrate: (persisted: unknown) => {
        const s = persisted as Record<string, unknown>;
        if ('soundEnabled' in s && !('vibrationEnabled' in s)) {
          return { vibrationEnabled: s.soundEnabled as boolean };
        }
        return s as unknown as SettingsStore;
      },
      version: 1,
    }
  )
);
