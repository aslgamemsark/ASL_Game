import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProgress, SkillLevel, Quest, QuestType, SpeedTier, Chest } from '@/types/user';
import { generateQuestsForToday } from '@/data/quests';
import { ALL_BADGES, getBadge } from '@/data/badges';

const STREAK_MILESTONES = [7, 30, 100];
const MILESTONE_GOLD: Record<number, number> = { 7: 5, 30: 15, 100: 50 };

const SKILL_UNLOCK_LESSONS: Record<SkillLevel, string[]> = {
  beginner: [],
  intermediate: ['greetings-1', 'cafe-order'],
  advanced: ['greetings-1', 'cafe-order', 'fingerspelling-1', 'fingerspelling-2'],
};

function defaultProgress(): UserProgress {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastPracticeDate: null,
    streakFreezes: 1,
    dailyGoalMinutes: 10,
    dailyProgressMinutes: 0,
    completedLessons: [],
    signAccuracy: {},
    achievements: [],
    onboardingComplete: false,
    skillLevel: 'beginner',
    dailyQuests: [],
    questsLastReset: '',
    streakMilestonesAwarded: [],
    signs: 0,
    gold: 0,
    badges: [],
    activeBadge: null,
    showcaseBadges: [],
    speedHighScores: {},
    totalCorrectSigns: 0,
    pendingChests: [],
    unlockedWorldIds: [],
    ownedCosmetics: [],
    equippedBorder: null,
    equippedAvatar: null,
    friends: [],
    renameCards: 0,
    // Opt-IN (default false): uploading hand/body landmark sequences is biometric-adjacent data,
    // so it must not be collected without an explicit choice. The user turns this on in Profile.
    collectTrainingData: false,
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface UserStore extends UserProgress {
  addXp: (amount: number) => void;
  addSigns: (amount: number) => void;
  addGold: (amount: number) => void;
  addDailyMinutes: (minutes: number) => void;
  completeLesson: (lessonId: string) => void;
  skipLesson: (lessonId: string, cost: number) => boolean;
  recordSign: (signId: string, correct: boolean) => void;
  checkStreak: () => number[];
  reset: () => void;
  mergeProgress: (remote: Partial<UserProgress>) => void;
  completeOnboarding: (level: SkillLevel) => void;
  refreshDailyQuests: () => void;
  updateQuestProgress: (type: QuestType, delta?: number) => void;
  claimQuest: (questId: string) => void;
  recordPracticeSession: () => void;
  checkBadges: () => string[];
  awardBadge: (id: string) => void;
  setActiveBadge: (id: string | null) => void;
  toggleShowcaseBadge: (id: string) => void;
  recordSpeedResult: (tier: SpeedTier, score: number, combo: number, signsEarned: number) => void;
  purchaseCosmetic: (itemId: string, goldPrice: number) => boolean;
  purchaseRenameCard: () => boolean;
  consumeRenameCard: () => boolean;
  unlockWorldWithGold: (worldId: string, cost: number) => boolean;
  equipBorder: (itemId: string | null) => void;
  equipAvatar: (itemId: string | null) => void;
  openChest: (chestId: string) => { signs: number; gold: number };
  skipChest: (chestId: string) => boolean;
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  setCollectTrainingData: (enabled: boolean) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...defaultProgress(),

      addXp: (amount) => {
        set((s) => {
          const newXp = s.xp + amount;
          return { xp: newXp, level: Math.floor(newXp / 100) + 1 };
        });
        get().checkBadges();
      },

      addSigns: (amount) => set((s) => ({ signs: s.signs + amount })),
      addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

      addDailyMinutes: (minutes) => {
        set((s) => ({ dailyProgressMinutes: s.dailyProgressMinutes + minutes }));
      },

      completeLesson: (lessonId) => {
        set((s) => {
          if (s.completedLessons.includes(lessonId)) return s;
          const newCompleted = [...s.completedLessons, lessonId];
          // Award a chest every 3rd completed lesson
          const newChests = [...s.pendingChests];
          if (newCompleted.length % 3 === 0) {
            newChests.push({
              id: `chest-${Date.now()}`,
              worldId: 'coffee',
              readyAt: Date.now() + 60 * 60 * 1000,
            });
          }
          return { completedLessons: newCompleted, pendingChests: newChests };
        });
        get().checkStreak();
        get().updateQuestProgress('complete_lesson', 1);
        get().checkBadges();
      },

      skipLesson: (lessonId, cost) => {
        const s = get();
        if (s.completedLessons.includes(lessonId) || s.signs < cost) return false;
        set((st) => {
          const newCompleted = [...st.completedLessons, lessonId];
          const newChests = [...st.pendingChests];
          if (newCompleted.length % 3 === 0) {
            newChests.push({
              id: `chest-${Date.now()}`,
              worldId: 'coffee',
              readyAt: Date.now() + 60 * 60 * 1000,
            });
          }
          return {
            completedLessons: newCompleted,
            pendingChests: newChests,
            signs: st.signs - cost,
          };
        });
        get().updateQuestProgress('complete_lesson', 1);
        get().checkBadges();
        return true;
      },

      recordSign: (signId, correct) => {
        set((s) => {
          const prev = s.signAccuracy[signId] ?? {
            attempts: 0,
            successes: 0,
            lastAttempt: 0,
            nextReviewAt: 0,
            interval: 1,
            easeFactor: 2.5,
          };

          let { interval, easeFactor } = prev;
          if (correct) {
            interval = interval === 1 ? 6 : Math.round(interval * easeFactor);
            easeFactor = Math.max(1.3, easeFactor + 0.1);
          } else {
            interval = 1;
            easeFactor = Math.max(1.3, easeFactor - 0.2);
          }

          const now = Date.now();
          return {
            signAccuracy: {
              ...s.signAccuracy,
              [signId]: {
                attempts: prev.attempts + 1,
                successes: prev.successes + (correct ? 1 : 0),
                lastAttempt: now,
                nextReviewAt: now + interval * 24 * 60 * 60 * 1000,
                interval,
                easeFactor,
              },
            },
            totalCorrectSigns: s.totalCorrectSigns + (correct ? 1 : 0),
          };
        });
        if (correct) get().updateQuestProgress('sign_correct', 1);
        get().checkBadges();
      },

      checkStreak: () => {
        const newlyAwarded: number[] = [];
        set((s) => {
          const today = todayStr();
          if (s.lastPracticeDate === today) return s;

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);

          let newStreak = s.streak;
          if (s.lastPracticeDate === yesterdayStr) {
            newStreak += 1;
          } else if (s.lastPracticeDate !== today) {
            if (s.streakFreezes > 0 && s.lastPracticeDate) {
              return { lastPracticeDate: today, streakFreezes: s.streakFreezes - 1 };
            }
            newStreak = 1;
          }

          let goldBonus = 0;
          const newMilestones = [...s.streakMilestonesAwarded];
          for (const m of STREAK_MILESTONES) {
            if (newStreak >= m && !newMilestones.includes(m)) {
              newMilestones.push(m);
              goldBonus += MILESTONE_GOLD[m] ?? 0;
              newlyAwarded.push(m);
            }
          }

          return {
            streak: newStreak,
            lastPracticeDate: today,
            streakMilestonesAwarded: newMilestones,
            gold: s.gold + goldBonus,
          };
        });
        get().updateQuestProgress('streak_days');
        get().checkBadges();
        return newlyAwarded;
      },

      reset: () => set(defaultProgress()),

      mergeProgress: (remote) => {
        set((local) => {
          const merged: Partial<UserProgress> = {};
          if ((remote.xp ?? 0) > local.xp) merged.xp = remote.xp;
          if ((remote.level ?? 1) > local.level) merged.level = remote.level;
          if ((remote.streak ?? 0) > local.streak) merged.streak = remote.streak;
          if (remote.completedLessons) {
            merged.completedLessons = Array.from(
              new Set([...local.completedLessons, ...remote.completedLessons])
            );
          }
          if (remote.signAccuracy) {
            const acc = { ...local.signAccuracy };
            for (const [id, rs] of Object.entries(remote.signAccuracy)) {
              const ls = local.signAccuracy[id];
              if (!ls || rs.lastAttempt > ls.lastAttempt) acc[id] = rs;
            }
            merged.signAccuracy = acc;
          }
          if (remote.lastPracticeDate) merged.lastPracticeDate = remote.lastPracticeDate;
          if (remote.collectTrainingData !== undefined) merged.collectTrainingData = remote.collectTrainingData;
          // Gold can legitimately decrease (spending), unlike xp/streak — but the case we must not
          // lose is an admin grant landing in Supabase while this device was offline, so take the
          // higher of the two rather than blindly trusting whichever side is "local."
          if (remote.gold !== undefined) merged.gold = Math.max(local.gold, remote.gold);
          if (remote.ownedCosmetics) {
            merged.ownedCosmetics = Array.from(new Set([...local.ownedCosmetics, ...remote.ownedCosmetics]));
          }
          // Equipped selections aren't cumulative — an admin-set cosmetic should show up on next
          // login, so take remote's value whenever the field was actually included in the payload.
          if (remote.equippedBorder !== undefined) merged.equippedBorder = remote.equippedBorder;
          if (remote.equippedAvatar !== undefined) merged.equippedAvatar = remote.equippedAvatar;
          return merged;
        });
      },

      completeOnboarding: (level) => {
        const toUnlock = SKILL_UNLOCK_LESSONS[level];
        set((s) => ({
          onboardingComplete: true,
          skillLevel: level,
          completedLessons: Array.from(new Set([...s.completedLessons, ...toUnlock])),
        }));
      },

      refreshDailyQuests: () => {
        const today = todayStr();
        const s = get();
        if (s.questsLastReset === today && s.dailyQuests.length > 0) return;

        const fresh = generateQuestsForToday().map((q) => {
          if (q.type === 'streak_days') {
            const prog = Math.min(s.streak, q.target);
            return { ...q, progress: prog, completed: prog >= q.target };
          }
          return q;
        });
        set({ dailyQuests: fresh, questsLastReset: today });
      },

      updateQuestProgress: (type, delta = 1) => {
        set((s) => {
          const updated = s.dailyQuests.map((q: Quest) => {
            if (q.type !== type || q.completed || q.claimed) return q;
            const newProgress =
              type === 'streak_days'
                ? Math.min(s.streak, q.target)
                : Math.min(q.progress + delta, q.target);
            return { ...q, progress: newProgress, completed: newProgress >= q.target };
          });
          return { dailyQuests: updated };
        });
      },

      claimQuest: (questId) => {
        set((s) => {
          const quest = s.dailyQuests.find((q: Quest) => q.id === questId);
          if (!quest || !quest.completed || quest.claimed) return s;
          const newXp = s.xp + quest.xpReward;
          return {
            dailyQuests: s.dailyQuests.map((q: Quest) =>
              q.id === questId ? { ...q, claimed: true } : q
            ),
            xp: newXp,
            level: Math.floor(newXp / 100) + 1,
            signs: s.signs + quest.signsReward,
          };
        });
      },

      recordPracticeSession: () => {
        get().updateQuestProgress('practice_session', 1);
      },

      checkBadges: () => {
        const s = get();
        const toAward: string[] = [];

        const conditions: Record<string, boolean> = {
          first_sign:     s.totalCorrectSigns >= 1,
          streak_7:       s.streak >= 7,
          streak_30:      s.streak >= 30,
          streak_100:     s.streak >= 100,
          lesson_5:       s.completedLessons.length >= 5,
          lesson_all:     s.completedLessons.length >= 14,
          greetings_story: s.completedLessons.includes('greetings-story'),
          coffee_story:   s.completedLessons.includes('coffee-story'),
          coffee_story_2: s.completedLessons.includes('coffee-story-2'),
          hospital_story: s.completedLessons.includes('hospital-story'),
          classroom_story: s.completedLessons.includes('classroom-story'),
          speed_warmup:   !!s.speedHighScores['warmup'],
          speed_sprint:   !!s.speedHighScores['sprint'],
          speed_blitz:    !!s.speedHighScores['blitz'],
          combo_5:        Object.values(s.speedHighScores).some((hs) => hs.combo >= 5),
          combo_10:       Object.values(s.speedHighScores).some((hs) => hs.combo >= 10),
          signs_50:       s.totalCorrectSigns >= 50,
          signs_200:      s.totalCorrectSigns >= 200,
          signs_500:      s.totalCorrectSigns >= 500,
          xp_100:         s.xp >= 100,
          xp_500:         s.xp >= 500,
          speed_score_50: Object.values(s.speedHighScores).some((hs) => hs.score >= 50),
        };

        for (const [id, met] of Object.entries(conditions)) {
          if (met && !s.badges.includes(id)) {
            toAward.push(id);
          }
        }

        if (toAward.length > 0) {
          let goldBonus = 0;
          for (const id of toAward) {
            const badge = getBadge(id);
            if (badge) goldBonus += badge.goldReward;
          }
          set((st) => ({
            badges: [...st.badges, ...toAward],
            gold: st.gold + goldBonus,
          }));
        }

        // Suppress unused import warning
        void ALL_BADGES;

        return toAward;
      },

      awardBadge: (id) => {
        set((s) => {
          if (s.badges.includes(id)) return s;
          const badge = getBadge(id);
          return {
            badges: [...s.badges, id],
            gold: s.gold + (badge?.goldReward ?? 0),
          };
        });
      },

      setActiveBadge: (id) => set({ activeBadge: id }),

      toggleShowcaseBadge: (id) => {
        set((s) => {
          if (s.showcaseBadges.includes(id)) {
            return { showcaseBadges: s.showcaseBadges.filter((b) => b !== id) };
          }
          if (s.showcaseBadges.length >= 3) return s;
          return { showcaseBadges: [...s.showcaseBadges, id] };
        });
      },

      recordSpeedResult: (tier, score, combo, signsEarned) => {
        set((s) => {
          const prev = s.speedHighScores[tier];
          if (prev && prev.score >= score) return s;
          return {
            speedHighScores: {
              ...s.speedHighScores,
              [tier]: { score, combo, signsEarned },
            },
          };
        });
        get().checkBadges();
      },

      purchaseCosmetic: (itemId, goldPrice) => {
        const s = get();
        if (s.gold < goldPrice || s.ownedCosmetics.includes(itemId)) return false;
        set((st) => ({ gold: st.gold - goldPrice, ownedCosmetics: [...st.ownedCosmetics, itemId] }));
        return true;
      },

      purchaseRenameCard: () => {
        const s = get();
        if (s.gold < 150) return false;
        set((st) => ({ gold: st.gold - 150, renameCards: st.renameCards + 1 }));
        return true;
      },

      consumeRenameCard: () => {
        const s = get();
        if (s.renameCards <= 0) return false;
        set((st) => ({ renameCards: st.renameCards - 1 }));
        return true;
      },

      // Alternative to finishing the previous world's story — either one unlocks a world, so
      // this only ever ADDS to unlockedWorldIds and never touches completedLessons (which would
      // falsely mark a story "done" the player never actually played).
      unlockWorldWithGold: (worldId, cost) => {
        const s = get();
        if (s.gold < cost || s.unlockedWorldIds.includes(worldId)) return false;
        set((st) => ({ gold: st.gold - cost, unlockedWorldIds: [...st.unlockedWorldIds, worldId] }));
        return true;
      },

      equipBorder: (itemId) => set({ equippedBorder: itemId }),
      equipAvatar: (itemId) => set({ equippedAvatar: itemId }),

      openChest: (chestId) => {
        const s = get();
        const chest = s.pendingChests.find((c: Chest) => c.id === chestId);
        if (!chest || chest.readyAt > Date.now()) return { signs: 0, gold: 0 };
        const signsWon = Math.floor(Math.random() * 150) + 50;
        const goldWon = Math.floor(Math.random() * 8) + 2;
        set((st) => ({
          pendingChests: st.pendingChests.filter((c: Chest) => c.id !== chestId),
          signs: st.signs + signsWon,
          gold: st.gold + goldWon,
        }));
        return { signs: signsWon, gold: goldWon };
      },

      skipChest: (chestId) => {
        const s = get();
        const chest = s.pendingChests.find((c: Chest) => c.id === chestId);
        if (!chest) return false;
        const hoursLeft = Math.ceil((chest.readyAt - Date.now()) / (1000 * 60 * 60));
        const cost = Math.max(5, hoursLeft * 20);
        if (s.gold < cost) return false;
        set((st) => ({
          gold: st.gold - cost,
          pendingChests: st.pendingChests.map((c: Chest) =>
            c.id === chestId ? { ...c, readyAt: 0 } : c
          ),
        }));
        return true;
      },

      addFriend: (userId) => set((s) => ({
        friends: s.friends.includes(userId) ? s.friends : [...s.friends, userId],
      })),

      removeFriend: (userId) => set((s) => ({
        friends: s.friends.filter((id) => id !== userId),
      })),

      setCollectTrainingData: (enabled) => set({ collectTrainingData: enabled }),
    }),
    { name: 'asl-game-progress' }
  )
);
