// ASL-H6 — content-depth / retention math (ad-hoc, not canonical suite).
// Computes total reachable content and time-to-exhaustion from the data files.
import { readFileSync } from 'fs';

const lessons = readFileSync('src/data/lessons.ts', 'utf8');
const stories = readFileSync('src/data/stories.ts', 'utf8');
const badges = readFileSync('src/data/badges.ts', 'utf8');

// Lesson XP totals
const lessonXps = [...lessons.matchAll(/xpReward:\s*(\d+)/g)].map(m => Number(m[1]));
const lessonTotal = lessonXps.reduce((a, b) => a + b, 0);
console.log(`lessons: ${lessonXps.length}, total one-time lesson XP: ${lessonTotal}`);

// Story XP/gold
const storyBlocks = stories.match(/title:\s*'[^']+'[\s\S]*?(?=\n  \{|\n\];)/g) || [];
console.log(`stories: ${storyBlocks.length}`);

// Badge count
const badgeIds = [...badges.matchAll(/^\s{2}id:\s*'([^']+)'/gm)].map(m => m[1]);
console.log(`badges: ${badgeIds.length}`);

// Ranks
const ranks = [...readFileSync('src/data/ranks.ts', 'utf8').matchAll(/minXp:\s*(\d+)/g)].map(m => Number(m[1]));
console.log('rank thresholds:', ranks.join(', '), '| max rank at', Math.max(...ranks), 'XP');

// Session-length estimate: G2 measured ~7s to reach live view; a 5-question session with skips
// took ~25-30s in probes (2s per question cycle + completion screen). With real signing each
// attempt is ~3-8s, so a 5-sign session ≈ 40-70s for a learner.
const avgSessionMin = 1.0;
console.log(`\n--- exhaustion math (all content, one pass) ---`);
console.log(`one-time lesson XP ${lessonTotal} + story replays are repeatable but low-XP`);
console.log(`at ~${avgSessionMin} min/session (5-sign practice or one lesson),`);
console.log(`16 lessons ≈ ${(16 * 2.5).toFixed(0)} min of unique lesson content at learner pace (~2.5 min/lesson incl. retries);`);
console.log(`6 stories ≈ ${(6 * 4).toFixed(0)} min more; letters A-Z free-practice unbounded but repetitive.`);
const xpToLegend = Math.max(...ranks);
const sessionsToLegend = Math.ceil(xpToLegend / 20);
console.log(`XP to ASL Legend: ${xpToLegend} => ~${sessionsToLegend} lessons' worth of XP (20 XP avg/lesson)`);
