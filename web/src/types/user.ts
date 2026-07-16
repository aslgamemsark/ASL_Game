export type QuestType = 'sign_correct' | 'complete_lesson' | 'practice_session' | 'streak_days';

export type SpeedTier = 'warmup' | 'sprint' | 'blitz';

export interface SpeedHighScore {
  score: number;
  combo: number;
  signsEarned: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  xpReward: number;
  signsReward: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  type: QuestType;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Chest {
  id: string;
  worldId: string;
  readyAt: number;
}

export interface UserProgress {
  xp: number;
  level: number;
  streak: number;
  lastPracticeDate: string | null;
  streakFreezes: number;
  dailyGoalMinutes: number;
  dailyProgressMinutes: number;
  completedLessons: string[];
  signAccuracy: Record<string, SignStats>;
  achievements: string[];
  onboardingComplete: boolean;
  skillLevel: SkillLevel;
  /** Which hand the user signs with, captured at onboarding. The recognition engine is
   *  handedness-agnostic (roles are assigned by motion), so this drives personalization/copy only,
   *  not verification. null until chosen or skipped (copy then assumes right-handed). */
  dominantHand: 'left' | 'right' | null;
  dailyQuests: Quest[];
  questsLastReset: string;
  streakMilestonesAwarded: number[];
  signs: number;
  gold: number;
  badges: string[];
  activeBadge: string | null;
  showcaseBadges: string[];
  speedHighScores: Record<string, SpeedHighScore>;
  totalCorrectSigns: number;
  pendingChests: Chest[];
  /** World ids unlocked by spending gold instead of finishing the previous world's story. */
  unlockedWorldIds: string[];
  ownedCosmetics: string[];
  equippedBorder: string | null;
  equippedAvatar: string | null;
  friends: string[];
  /** Consumable rename cards owned; each one allows one username change. */
  renameCards: number;
  /** Opt-out: when true, passed/failed attempts also save a landmark snapshot for future model training. */
  collectTrainingData: boolean;
}

export interface SignStats {
  attempts: number;
  successes: number;
  lastAttempt: number;
  nextReviewAt: number;
  interval: number;
  easeFactor: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}
