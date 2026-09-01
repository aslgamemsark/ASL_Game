import type { SignPracticeMode, SignStats } from '@/types/user';

export function getSignsDueForReview(
  signAccuracy: Record<string, SignStats>,
  limit = 10,
  mode?: SignPracticeMode,
): string[] {
  const now = Date.now();
  const due = Object.entries(signAccuracy)
    .filter(([, stats]) => (stats.byMode?.[mode ?? 'receptive'] ?? stats).nextReviewAt <= now)
    .sort(([, a], [, b]) => (a.byMode?.[mode ?? 'receptive'] ?? a).nextReviewAt - (b.byMode?.[mode ?? 'receptive'] ?? b).nextReviewAt)
    .map(([id]) => id);

  if (due.length >= limit) return due.slice(0, limit);

  const weakest = Object.entries(signAccuracy)
    .filter(([id]) => !due.includes(id))
    .sort(([, a], [, b]) => {
      const aMode = a.byMode?.[mode ?? 'receptive'];
      const bMode = b.byMode?.[mode ?? 'receptive'];
      const weakestParameter = (stats: typeof aMode) => stats?.parameters
        ? Math.min(...Object.values(stats.parameters).filter((parameter) => parameter.attempts >= 3).map((parameter) => parameter.score), 1)
        : 1;
      const aRate = Math.min(weakestParameter(aMode), (aMode ?? a).attempts > 0 ? (aMode ?? a).successes / (aMode ?? a).attempts : 0);
      const bRate = Math.min(weakestParameter(bMode), (bMode ?? b).attempts > 0 ? (bMode ?? b).successes / (bMode ?? b).attempts : 0);
      return aRate - bRate;
    })
    .map(([id]) => id);

  return [...due, ...weakest].slice(0, limit);
}

export function pickReceptiveDistractors(
  correctId: string,
  allSignIds: string[],
  count = 3
): string[] {
  const pool = allSignIds.filter((id) => id !== correctId);
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
