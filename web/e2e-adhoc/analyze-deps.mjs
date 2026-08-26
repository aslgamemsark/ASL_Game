// ASL-J3 — unused dependency scan (ad-hoc, not canonical suite).
// For each direct dependency in package.json, check whether its name appears anywhere in src/,
// index.html, vite.config.ts, or e2e configs. Purely heuristic (string match), reported honestly.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

let srcAll = '';
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else {
      if (!/\.(ts|tsx|js|jsx|html|json|css|md)$/.test(e)) return void 0;
      try { srcAll += readFileSync(p, 'utf8'); } catch {}
    }
  }
})('src');
for (const f of ['index.html', 'vite.config.ts', 'playwright.config.ts']) {
  try { srcAll += readFileSync(f, 'utf8'); } catch {}
}

console.log('dep | used-in-src?');
const unused = [];
for (const name of Object.keys(deps).sort()) {
  // strip scope for matching but check full too
  const bare = name.includes('/') ? name.split('/')[1] : name;
  const used = srcAll.includes(name) || new RegExp(`from\\s+['"]${name}`, 'i').test(srcAll) ||
               new RegExp(`import\\(['"]${bare}`,'i').test(srcAll) || srcAll.includes(bare + '-');
  console.log(`${name.padEnd(32)} ${used ? 'USED' : 'NOT-FOUND'}`);
  if (!used) unused.push(name);
}
console.log('\nnot-found-by-string-match:', unused.length ? unused.join(', ') : '(none)');
console.log('(heuristic only: build-tool plugins/config-only deps may legitimately never appear in src strings)');
