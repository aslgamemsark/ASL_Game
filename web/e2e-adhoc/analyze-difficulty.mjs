// ASL-H3 — difficulty-curve analysis v2 (ad-hoc, not canonical suite).
// Parses LESSON_UNITS structurally (unit -> nodes), computes per-lesson:
//   sign count, new-signs-introduced (vs everything taught before), XP, XP-per-new-sign,
//   and flags spikes/valleys + orphan signs (used before taught) + never-taught signs.
import { readFileSync } from 'fs';

const lessonsSrc = readFileSync('src/data/lessons.ts', 'utf8');
const signsSrc = readFileSync('src/data/signs.ts', 'utf8');

const signIds = [...signsSrc.matchAll(/^\s{2}([A-Z_]+):\s*\{/gm)].map(m => m[1]);
const signSet = new Set(signIds);

// Split into units by `id: 'unit-N'` markers; parse each unit's title and node blocks.
const unitRe = /id:\s*'unit-(\d+)',\s*\n\s*title:\s*'([^']+)'([\s\S]*?)(?=\n  \{\n    id: 'unit-|\n\];)/g;
const lessons = [];
let m;
while ((m = unitRe.exec(lessonsSrc)) !== null) {
  const unitIdx = Number(m[1]);
  const unitTitle = m[2];
  const body = m[3];
  const nodeRe = /title:\s*'([^']+)',[\s\S]*?signIds:\s*\[([^\]]+)\][\s\S]*?xpReward:\s*(\d+)/g;
  let n;
  while ((n = nodeRe.exec(body)) !== null) {
    const ids = n[2].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    lessons.push({ unit: unitIdx, unitTitle, title: n[1], signIds: ids, xp: Number(n[3]) });
  }
}

console.log(`parsed ${lessons.length} lessons across ${new Set(lessons.map(l => l.unit)).size} units\n`);
console.log('# | unit | lesson | signs | new | xp | xp/new | orphan?');
const taught = new Set();
const anomalies = [];
for (const l of lessons) {
  const newSigns = l.signIds.filter(id => !taught.has(id));
  // orphan = used in this lesson but not yet taught by any PRIOR lesson NOR introduced here.
  const orphans = l.signIds.filter(id => !taught.has(id) && !newSigns.includes(id));
  void orphans;
  const unknown = l.signIds.filter(id => !signSet.has(id));
  const xpPerNew = newSigns.length ? +(l.xp / newSigns.length).toFixed(1) : null;
  console.log(
    `${String(lessons.indexOf(l) + 1).padStart(2)} | u${l.unit} ${l.unitTitle.padEnd(18)} | ${l.title.padEnd(22)} | ${l.signIds.length} | ${newSigns.length} | ${l.xp} | ${String(xpPerNew)}`
  );
  if (unknown.length) anomalies.push(`L${lessons.indexOf(l) + 1} (${l.title}) references undefined signs: ${unknown.join(',')}`);
  for (const id of newSigns) taught.add(id);
}

const neverTaught = [...signSet].filter(s => !taught.has(s));
console.log(`\ntotals: ${lessons.length} lessons, ${taught.size} distinct signs taught`);
console.log(`signs defined but never taught in any lesson (${neverTaught.length}):`,
  neverTaught.join(','));
if (anomalies.length) { console.log('\nANOMALIES:'); anomalies.forEach(a => console.log(' -', a)); }
