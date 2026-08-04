// One-off optimization pass over web/public's remaining unoptimized PNGs (2026-07-30 perf audit).
// Unlike optimize-zippy.mjs this has no source-defect workarounds to encode — it's a straight
// recompress/reformat, run once and checked in, not part of the regular build.
//
// Run:  node scripts/optimize-images.mjs

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { statSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const kb = (p) => (statSync(p).size / 1024).toFixed(1);

async function main() {
  // desktop-home.png: confirmed unreferenced anywhere in the repo (landing.html, source, docs) —
  // dead weight, not just unoptimized.
  const deadFile = join(PUBLIC_DIR, 'shots', 'desktop-home.png');
  if (existsSync(deadFile)) {
    console.log(`  ✗ deleting unreferenced shots/desktop-home.png (${kb(deadFile)} KB)`);
    unlinkSync(deadFile);
  }

  // Landing-page screenshots: plain <img> tags, no format constraint — WebP is a clean win.
  // landing.html's src attributes are updated to match below.
  for (const name of ['home', 'signcoach', 'story', 'multiplayer', 'privacy']) {
    const src = join(PUBLIC_DIR, 'shots', `${name}.png`);
    if (!existsSync(src)) continue;
    const before = kb(src);
    const out = join(PUBLIC_DIR, 'shots', `${name}.webp`);
    await sharp(src).webp({ quality: 82 }).toFile(out);
    unlinkSync(src);
    console.log(`  ✓ shots/${name}.png (${before} KB) -> ${name}.webp (${kb(out)} KB)`);
  }

  // App/social icons: format-constrained (PWA manifest icons and apple-touch-icon must be PNG;
  // og:image is safest as PNG/JPG for social-platform crawlers) — recompress in place, same
  // filename, so nothing else needs to change.
  for (const rel of ['og-image.png', 'pwa-512x512.png', 'pwa-192x192.png', 'apple-touch-icon.png']) {
    const p = join(PUBLIC_DIR, rel);
    if (!existsSync(p)) continue;
    const before = kb(p);
    const buf = await sharp(p).png({ quality: 80, compressionLevel: 9, palette: true }).toBuffer();
    if (buf.length < statSync(p).size) {
      writeFileSync(p, buf);
      console.log(`  ✓ ${rel} (${before} KB) -> ${kb(p)} KB`);
    } else {
      console.log(`  = ${rel} (${before} KB) already smaller than re-encode — left alone`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
