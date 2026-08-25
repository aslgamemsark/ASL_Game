// ASL-D1 — UI/UX sweep execution probe (ad-hoc, not part of the canonical suite).
// Walks every guest-reachable page at 3 viewports x 2 themes against the production build and,
// per combination, records: horizontal overflow (scrollWidth > clientWidth), elements spilling
// the viewport, text-contrast estimate via computed colors (WCAG ratio), and a screenshot for
// eyeballing. Outputs one JSON line per combination; exit 0 iff no overflow anywhere.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['dark', 'light'];

function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg, bg) {
  const l1 = luminance(fg), l2 = luminance(bg);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
}

const b = await chromium.launch();
let worstContrast = Infinity;
let worstWhere = '';
let overflowCount = 0;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await b.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme,
    });
    const p = await ctx.newPage();
    await p.goto(BASE);
    // Theme is stored in localStorage under ThemeContext's key; set before app scripts run.
    await p.evaluate((t) => localStorage.setItem('asl-game-theme', t), theme);
    await p.reload({ waitUntil: 'networkidle' });
    const applied = await p.evaluate(() => document.documentElement.className);
    if (!applied.includes(theme)) console.log(`WARN: theme "${theme}" not on <html> (${applied})`);

    // Guest onboarding (fresh context each combo, so this always runs).
    await p.getByRole('button', { name: /get started/i }).click();
    await p.getByRole('button', { name: /continue as guest/i }).click();
    await p.getByRole('button', { name: /just starting/i }).click();
    // At tablet width BOTH navs exist but BottomNav is display:none (SideNav band >=768px) —
    // wait for whichever nav is actually visible rather than assuming the last one.
    await p
      .locator("nav[aria-label='Main']")
      .filter({ visible: true })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });

    async function auditPage(name) {
      await p.waitForTimeout(900); // entrance transitions settle
      const m = await p.evaluate(() => {
        const doc = document.documentElement;
        const overflowX = doc.scrollWidth - doc.clientWidth;
        // Elements extending beyond the viewport horizontally.
        const spill = [];
        for (const el of document.querySelectorAll('main *, body > div *')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > doc.clientWidth + 2 && getComputedStyle(el).position !== 'fixed') {
            spill.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(r.right)}`);
            if (spill.length >= 4) break;
          }
        }
        // Text-contrast sample: visible leaf-ish text nodes vs their effective background.
        let minC = Infinity, minText = '';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const txt = node.textContent.trim();
          if (txt.length < 3) continue;
          const el = node.parentElement;
          if (!el) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.4) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          const fg = cs.color;
          let bgEl = el, bg = 'rgba(0, 0, 0, 0)';
          while (bgEl) {
            const c = getComputedStyle(bgEl).backgroundColor;
            if (c && !c.includes('0, 0, 0, 0')) { bg = c; break; }
            bgEl = bgEl.parentElement;
          }
          if (bg.includes('0, 0, 0, 0') || !/^\s*rgb/.test(fg)) continue;
          try {
            const cr = parseFloat(contrast(fg, bg));
            if (cr < minC) { minC = cr; minText = txt.slice(0, 30); }
          } catch { /* non-rgb color */ }
        }
        return { overflowX, spill, minC: Number.isFinite(minC) ? minC : null, minText };
      });
      if (m.overflowX > 2) overflowCount++;
      if (m.minC !== null && m.minC < worstContrast) {
        worstContrast = m.minC; worstWhere = `${name} @${vp.name}/${theme}: "${m.minText}"`;
      }
      console.log(JSON.stringify({
        combo: `${vp.name}/${theme}`, page: name,
        overflowPx: m.overflowX, spills: m.spill.length,
        spillSample: m.spill[0] || null,
        minContrast: m.minC, minContrastText: m.minText,
      }));
      await p.screenshot({ path: `e2e-adhoc/d1-${vp.name}-${theme}-${name}.png` }).catch(() => {});
    }

    await auditPage('home');
    const nav = p.locator("nav[aria-label='Main']").filter({ visible: true }).first();
    // Home tabs (both navs expose them): Alphabets, Review.
    for (const label of ['Alphabets', 'Review']) {
      await nav.getByRole('button', { name: new RegExp(label) }).first().click();
      await p.waitForTimeout(600);
      await auditPage(`tab-${label.toLowerCase()}`);
      await nav.getByRole('button', { name: /Journey|Home/ }).first().click();
      await p.waitForTimeout(400);
    }
    // Screens via the Me tab's Explore grid (works on phone; on desktop the Me tab is reachable
    // via SideNav's profile chip, so click that first).
    for (const label of ['Leaderboard', 'Friends', 'Multiplayer', 'Settings']) {
      const chip = p.getByRole('button', { name: /Me|View profile/ }).first();
      if (vp.name === 'desktop') {
        await chip.click(); await p.waitForTimeout(400);
      } else {
        await nav.getByRole('button', { name: /Me/ }).first().click(); await p.waitForTimeout(400);
      }
      await p.getByRole('button', { name: new RegExp(`${label}$`) }).first().click();
      await p.waitForTimeout(600);
      await auditPage(`screen-${label.toLowerCase()}`);
      const back = p.getByRole('button', { name: /back|close/i }).first();
      if (await back.isVisible().catch(() => false)) { await back.click(); } else {
        await nav.getByRole('button', { name: /Journey/ }).first().click();
      }
      await p.waitForTimeout(500);
    }
    await ctx.close();
  }
}

console.log('\nD1 SUMMARY:');
console.log('combinations with horizontal overflow:', overflowCount);
console.log('worst text contrast seen:', worstContrast, '@', worstWhere);
process.exit(overflowCount > 0 ? 1 : 0);
