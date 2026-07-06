export interface Rank {
  name: string;
  emoji: string;
  minXp: number;
  maxXp: number | null;
}

export const RANKS: Rank[] = [
  { name: 'Beginner',      emoji: '🌱', minXp: 0,      maxXp: 499   },
  { name: 'Learner',       emoji: '📘', minXp: 500,    maxXp: 1499  },
  { name: 'Communicator',  emoji: '🗨️', minXp: 1500,   maxXp: 3499  },
  { name: 'Fluent Signer', emoji: '🤝', minXp: 3500,   maxXp: 6499  },
  { name: 'Sign Master',   emoji: '🎓', minXp: 6500,   maxXp: 9999  },
  { name: 'ASL Legend',    emoji: '🌟', minXp: 10000,  maxXp: null  },
];

export function getRank(xp: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) return RANKS[i];
  }
  return RANKS[0];
}

export function getRankProgress(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  const rank = getRank(xp);
  const idx = RANKS.indexOf(rank);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const progress = next
    ? (xp - rank.minXp) / (next.minXp - rank.minXp)
    : 1;
  return { rank, next, progress };
}
