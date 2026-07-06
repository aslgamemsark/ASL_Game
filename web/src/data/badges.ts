export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  goldReward: number;
}

export const BADGE_RARITY_COLOR: Record<BadgeRarity, string> = {
  common:    '#A78BFA',
  rare:      '#38BDF8',
  epic:      '#F59E0B',
  legendary: '#F97316',
};

export const ALL_BADGES: BadgeDef[] = [
  { id: 'first_sign',     title: 'First Sign',     description: 'Sign your first word correctly',               icon: '✍️',  rarity: 'common',    goldReward: 0  },
  { id: 'streak_7',       title: 'On Fire',         description: '7-day signing streak',                        icon: '🔥',  rarity: 'common',    goldReward: 5  },
  { id: 'streak_30',      title: 'Blazing',         description: '30-day signing streak',                       icon: '🌋',  rarity: 'rare',      goldReward: 15 },
  { id: 'streak_100',     title: 'Inferno',         description: '100-day signing streak',                      icon: '⚡',  rarity: 'epic',      goldReward: 50 },
  { id: 'lesson_5',       title: 'Quick Learner',   description: 'Complete 5 lessons',                          icon: '📚',  rarity: 'common',    goldReward: 2  },
  { id: 'lesson_all',     title: 'Graduate',        description: 'Complete all available lessons',              icon: '🎓',  rarity: 'rare',      goldReward: 10 },
  { id: 'greetings_story', title: 'Friendly Face',  description: 'Complete the Say Hello story',                icon: '👋',  rarity: 'common',    goldReward: 3  },
  { id: 'coffee_story',   title: 'Coffee Master',   description: 'Complete the Coffee Shop story',              icon: '☕',  rarity: 'common',    goldReward: 5  },
  { id: 'coffee_story_2', title: 'Rush Hour Hero',  description: 'Complete the Coffee Shop: Rush Hour story',   icon: '⏰',  rarity: 'rare',      goldReward: 8  },
  { id: 'hospital_story', title: 'Medical Expert',  description: 'Complete the Hospital story',                 icon: '🏥',  rarity: 'rare',      goldReward: 8  },
  { id: 'classroom_story', title: 'Star Student',   description: 'Complete the Classroom story',                icon: '🏫',  rarity: 'rare',      goldReward: 8  },
  { id: 'speed_warmup',   title: 'Warmed Up',       description: 'Complete a Warm Up speed challenge',          icon: '🌡️', rarity: 'common',    goldReward: 2  },
  { id: 'speed_sprint',   title: 'Sprinter',        description: 'Complete a Sprint speed challenge',           icon: '🏃',  rarity: 'common',    goldReward: 3  },
  { id: 'speed_blitz',    title: 'Blitz King',      description: 'Complete a Blitz speed challenge',            icon: '⚡',  rarity: 'rare',      goldReward: 5  },
  { id: 'combo_5',        title: 'On a Roll',       description: 'Hit a 5-sign combo in Speed Challenge',       icon: '🎯',  rarity: 'common',    goldReward: 2  },
  { id: 'combo_10',       title: 'Unstoppable',     description: 'Hit a 10-sign combo in Speed Challenge',      icon: '💫',  rarity: 'rare',      goldReward: 5  },
  { id: 'signs_50',       title: 'Practicing Hard', description: 'Sign 50 correct signs total',                 icon: '💪',  rarity: 'common',    goldReward: 3  },
  { id: 'signs_200',      title: 'Sign Master',     description: 'Sign 200 correct signs total',                icon: '🤟',  rarity: 'rare',      goldReward: 8  },
  { id: 'signs_500',      title: 'Legend',          description: 'Sign 500 correct signs total',                icon: '🏆',  rarity: 'epic',      goldReward: 20 },
  { id: 'xp_100',         title: 'Century',         description: 'Reach 100 XP',                               icon: '🌟',  rarity: 'common',    goldReward: 3  },
  { id: 'xp_500',         title: 'Scholar',         description: 'Reach 500 XP',                               icon: '📖',  rarity: 'rare',      goldReward: 8  },
  { id: 'alphabet_ace',   title: 'Alphabet Ace',    description: 'Sign all letters correctly in one session',   icon: '🔤',  rarity: 'epic',      goldReward: 15 },
  { id: 'speed_score_50', title: 'Speed Demon',     description: 'Score 50+ in any Speed Challenge',            icon: '💨',  rarity: 'rare',      goldReward: 10 },
];

export function getBadge(id: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}
