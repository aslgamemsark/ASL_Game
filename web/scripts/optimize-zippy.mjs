// Optimize the raw Zippy mascot art (1568x2668, ~6MB PNG each) into web-ready WebP.
//
// The source PNGs live in web/zippy-src/ (gitignored — see .gitignore). We ship only the
// optimized web/public/zippy/<role>.webp outputs, which are ~99% smaller and sized for the
// largest in-app use (~200px tall) at 2x retina.
//
// Run:  npm run optimize:zippy
//
// The mapping is by ROLE (semantic), not by source filename — a couple of source names don't
// perfectly match their pose, so this file is the single source of truth for which art plays
// which role. A labeled contact sheet is written to zippy-src/_contact.png for visual QA.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'zippy-src');
const OUT_DIR = join(__dirname, '..', 'public', 'zippy');

// role (output name) -> source PNG filename
const MAP = {
  welcome: 'zippy_welcome.png',
  teaching: 'zippy_teaching.png',
  thinking: 'zippy_thinking.png',
  encouraging: 'zippy_confused.png',
  thumbsup: 'zippy_thumbsup.png',
  celebrating: 'zippy_celeberating.png',
  proud: 'zippy_proud.png',
  applauding: 'zippy_applauding.png',
  oops: 'zippy_oops.png',
};

const TARGET_H = 512; // px tall; covers the largest in-app render (~200px) at 2x+
const WEBP_QUALITY = 82;

mkdirSync(OUT_DIR, { recursive: true });

const kb = (p) => (statSync(p).size / 1024).toFixed(1);

// A few source PNGs have an opaque near-white background baked in (welcome/thumbsup/celebrating)
// while others are cleanly cut out. Flood-fill from the four edges: mark every border-connected
// near-white OR already-transparent pixel as transparent. Because it only spreads from the edges,
// Zippy's INTERIOR white (his eyes) is untouched — a naive global white→alpha would blow holes in
// them. Idempotent on images that are already transparent.
function floodFillBackground(data, w, h) {
  const isBg = (p) => {
    const i = p * 4;
    if (data[i + 3] < 16) return true; // already transparent
    return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225; // near-white
  };
  const visited = new Uint8Array(w * h);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p] || !isBg(p)) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
  for (let y = 0; y < h; y++) { consider(0, y); consider(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
  }
}

async function run() {
  const roles = Object.keys(MAP);
  const cells = [];

  for (const role of roles) {
    const srcPath = join(SRC_DIR, MAP[role]);
    if (!existsSync(srcPath)) {
      console.error(`  ✗ ${role}: source missing (${MAP[role]}) — skipped`);
      continue;
    }
    const outPath = join(OUT_DIR, `${role}.webp`);

    // trim() removes the uniform border so the character fills the frame; resize to a fixed
    // height keeping aspect, never enlarging; then cut out any opaque background.
    const { data, info } = await sharp(srcPath)
      .trim()
      .resize({ height: TARGET_H, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    floodFillBackground(data, info.width, info.height);

    // Second trim tightens the frame now that the background is gone, so all 9 crop consistently.
    const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim()
      .webp({ quality: WEBP_QUALITY, alphaQuality: 90, effort: 6 })
      .toBuffer();

    await sharp(buf).toFile(outPath);
    console.log(`  ✓ ${role.padEnd(12)} ${kb(outPath).padStart(6)} KB   (${MAP[role]})`);
    cells.push({ role, buf });
  }

  await writeContactSheet(cells);
  console.log(`\nDone. ${cells.length} expressions → ${OUT_DIR}`);
  console.log('Contact sheet for QA: zippy-src/_contact.png');
}

// A 3-col dark grid with a role label under each pose, for a single-glance pose→role check.
async function writeContactSheet(cells) {
  if (!cells.length) return;
  const CELL_W = 240;
  const CELL_H = 300;
  const LABEL_H = 34;
  const cols = 3;
  const rows = Math.ceil(cells.length / cols);
  const W = cols * CELL_W;
  const H = rows * (CELL_H + LABEL_H);

  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = col * CELL_W;
    const y0 = row * (CELL_H + LABEL_H);

    const thumb = await sharp(cells[i].buf)
      .resize({ width: CELL_W - 24, height: CELL_H - 24, fit: 'inside' })
      .toBuffer();
    const meta = await sharp(thumb).metadata();
    composites.push({
      input: thumb,
      left: x0 + Math.round((CELL_W - meta.width) / 2),
      top: y0 + Math.round((CELL_H - meta.height) / 2),
    });

    const label = Buffer.from(
      `<svg width="${CELL_W}" height="${LABEL_H}"><text x="${CELL_W / 2}" y="22" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">${cells[i].role}</text></svg>`
    );
    composites.push({ input: label, left: x0, top: y0 + CELL_H });
  }

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 13, g: 10, b: 30, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(join(SRC_DIR, '_contact.png'));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
