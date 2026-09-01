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
  /** Calendar day (YYYY-MM-DD, local) that `dailyProgressMinutes` is counting. When it isn't
   *  today, the stored minutes belong to a past day and count as 0 — this is what makes the
   *  daily counter reset at midnight instead of accumulating forever. null before first practice. */
  dailyProgressDate: string | null;
  completedLessons: string[];
  signAccuracy: Record<string, SignStats>;
  achievements: string[];
  onboardingComplete: boolean;
  /** Whether the amplified first-lesson-ever celebration has already played. Not derived from
   *  completedLessons.length === 1 — completeOnboarding pre-seeds that array for intermediate/
   *  advanced skill levels, so length alone can't tell a genuine first play-through from a
   *  pre-unlocked lesson. */
  firstLessonCelebrated: boolean;
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
  /** Missing on pre-mode records: their receptive and expressive history is unknown, not zero. */
  byMode?: Partial<Record<SignPracticeMode, ModeSignStats>>;
}

export type SignPracticeMode = 'receptive' | 'expressive';

export interface SignParameterEvidence {
  score: number;
  threshold: number;
}

export interface ParameterMastery {
  attempts: number;
  score: number;
  lastAttempt: number;
  /** Missing on legacy records whose verifier semantics are unknown. */
  evidenceSchemaVersion?: number;
  recognitionVersion?: string;
}

export interface ModeSignStats {
  attempts: number;
  successes: number;
  lastAttempt: number;
  nextReviewAt: number;
  interval: number;
  easeFactor: number;
  /** Expressive-only evidence. Receptive records deliberately never populate this field. */
  parameters?: Record<string, ParameterMastery>;
}

export interface SignAttemptInput {
  signId: string;
  mode: SignPracticeMode;
  correct: boolean;
  params?: Record<string, SignParameterEvidence>;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}
