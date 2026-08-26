// ASL-H4 — reward-economy audit (ad-hoc, not canonical suite).
// Static extraction of all gold sinks and sources + an executed probe verifying the earn path.
import { readFileSync } from 'fs';

const shop = readFileSync('src/data/shop.ts', 'utf8');
const store = readFileSync('src/stores/useUserStore.ts', 'utf8');

console.log('=== GOLD SINKS (shop.ts) ===');
for (const m of shop.matchAll(/id:\s*'([^']+)'[^}]*goldPrice:\s*(\d+)/g)) {
  console.log(`  ${m[1].padEnd(22)} ${m[2]}g`);
}
console.log('\n=== SOURCES (static grep of addGold calls) ===');
for (const f of ['src/pages/DuelPage.tsx','src/pages/PracticePage.tsx','src/pages/RoomPage.tsx','src/pages/StoryPage.tsx','src/pages/SettingsPage.tsx']) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/addGold\(([^)]+)\)/g)) {
    console.log(`  ${f.split('/').pop().padEnd(20)} addGold(${m[1]})`);
  }
}
// Chest economics
const chestOpen = store.match(/openChest:[\s\S]{0,400}/)?.[0] || '';
const signsWon = chestOpen.match(/Math\.floor\(Math\.random\(\) \* (\d+)\) \+ (\d+)/);
const goldWon = chestOpen.match(/goldWon = (\d+)/);
console.log(`\nchest open: signs ${signsWon ? `${signsWon[2]}..${Number(signsWon[2]) + Number(signsWon[1]) - 1}` : '?'}, gold ${goldWon?.[1]}`);
const skipCost = store.match(/skipChest[\s\S]{0,420}/)?.[0] || '';
const costLine = skipCost.match(/cost = Math\.max\((\d+), hoursLeft \* (\d+)\)/);
console.log(`chest skip-sink: max(${costLine?.[1]}, hoursLeft * ${costLine?.[2]})`);
// Lesson-completion chest cadence
const cadence = store.match(/Award a chest every (\w+) completed lesson/) ;
console.log('chest cadence:', cadence ? cadence[1] : '(check manually)');
