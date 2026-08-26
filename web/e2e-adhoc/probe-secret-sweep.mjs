// ASL-J1 — client-bundle secret sweep against dist/ (ad-hoc, not canonical suite).
// Greps the BUILT output (dist/) for secret/credential patterns. Read-only.
// Patterns: Supabase service keys, OpenAI/Gemini/Anthropic keys, generic API-key shapes,
// JWTs, private key blocks, bearer tokens, .env variable names that shouldn't be inlined.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = 'dist';
const findings = [];
let filesScanned = 0;

const PATTERNS = [
  { name: 'supabase_service_role', re: /sbp_[a-zA-Z0-9]{30,}|service_role/i },
  { name: 'openai_key', re: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'gemini_google_key', re: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'anthropic_key', re: /sk-ant-[a-zA-Z0-9\-_]{20,}/g },
  { name: 'jwt_token', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'private_key_block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'bearer_secret', re: /bearer\s+[a-zA-Z0-9_\-\.]{25,}/gi },
  { name: 'generic_api_key_var', re: /(apiKey|api_key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9+/_\-]{20,}={0,2}["']/gi },
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      filesScanned++;
      let content = '';
      try { content = readFileSync(p, 'utf8'); } catch { continue; } // skip binary
      for (const { name, re } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content)) !== null) {
          // capture surrounding context, redact the match itself
          const start = Math.max(0, m.index - 40);
          const ctx = content.slice(start, m.index + m[0].length + 20).replace(/\n/g, '\\n');
          const redacted = ctx.replace(m[0], '[REDACTED:' + name + ']');
          findings.push({ file: p.replace(/\\/g, '/'), pattern: name, context: redacted });
        }
      }
    }
  }
}
walk(ROOT);

console.log(`files scanned: ${filesScanned}`);
console.log(`findings: ${findings.length}`);
for (const f of findings.slice(0, 20)) {
  console.log(`\n[${f.pattern}] ${f.file}\n  ...${f.context}...`);
}
if (findings.length > 20) console.log(`\n(+${findings.length - 20} more)`);

// Known-public values that are EXPECTED in a client bundle (anon keys are public by design,
// PostHog project tokens are public by design). Flag separately so they aren't mistaken for leaks.
console.log('\n--- expected public values (context check only) ---');
let distAll = '';
try {
  function walk2(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk2(p);
      else { try { distAll += readFileSync(p, 'utf8'); } catch {} }
    }
  }
  walk2(ROOT);
} catch {}
const expected = [
  ['VITE_SUPABASE_URL present', /https:\/\/[a-z0-9]+\.supabase\.co/.test(distAll)],
  ['posthog token shape present', /phc_[A-Za-z0-9]{20,}/.test(distAll)],
];
for (const [label, ok] of expected) console.log(`${ok ? 'PRESENT' : 'ABSENT '} | ${label}`);

process.exit(findings.length ? 1 : 0);
