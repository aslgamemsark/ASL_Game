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
//
// Source-art defects this pipeline works around (found via pixel inspection, not guesswork):
//  1. Several sources have an OPAQUE background that isn't pure white (grayish/cream, RGB
//     ~195-230) — too far from a hardcoded ">225 near-white" test to catch reliably.
//  2. At least one source has a faint horizontal band (looks like a flattened watermark/preview
//     banner) baked in as fully-opaque pixels around y=41% — same grayish range as #1.
//  3. A couple have small disconnected decorative artifacts (a sparkle glyph) away from the
//     character, which a border-flood-fill alone won't remove since they don't touch the edge.
// Fix: flood-fill from the border using COLOR-DISTANCE to a per-image sampled background
// reference (not a fixed white threshold) — this catches off-white and the gray band alike —
// then keep only the largest remaining connected component (Zippy's body), dropping any island
// (sparkle, stray watermark fragment) as background too.

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
  // Generic app-loading pose: the calm "hands clasped, waiting" art reads better as a neutral
  // spinner companion than the binoculars "searching" pose (which is reserved for camera-loading).
  loading: 'zippy-waiting.png',
  // Second batch (2026-07-13) — hyphenated source names, delivered in D:\Zippy-Images.
  looking: 'zippy-looking.png',
  reading: 'zippy-reading.png',
  ready: 'zippy-ready.png',
  streak: 'zippy-streak.png',
  tryagain: 'zippy-tryagain.png',
  surprised: 'zippy-surprised.png',
  reward: 'zippy-reward.png',
  levelup: 'zippy-levelup.png',
  achievement: 'zippy-achievement.png',
  goodbye: 'zippy-goodbye.png',
  sleeping: 'zippy-sleeping.png',
};

const TARGET_H = 512; // px tall; covers the largest in-app render (~200px) at 2x+
const BG_DIST = 70; // RGB Euclidean distance under which a pixel counts as "background-like"

mkdirSync(OUT_DIR, { recursive: true });

const kb = (p) => (statSync(p).size / 1024).toFixed(1);

function sampleBackground(data, w, h) {
  // Average a ring of border pixels (skipping any that are already transparent) as the
  // background reference — robust to whether the source canvas is white, cream, or grayish.
  const pts = [];
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 40))) { pts.push([x, 0]); pts.push([x, h - 1]); }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))) { pts.push([0, y]); pts.push([w - 1, y]); }
  let r = 0, g = 0, b = 0, n = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 16) continue; // already-transparent border pixel, skip
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (n === 0) return [245, 243, 239]; // fallback: generic off-white
  return [r / n, g / n, b / n];
}

function colorDist(data, i, ref) {
  const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Border flood-fill using color-distance to the sampled background (catches off-white AND the
// grayish watermark band alike), not a fixed white threshold. Marks matched pixels alpha=0.
function floodFillBackground(data, w, h, bgRef) {
  const isBg = (p) => {
    const i = p * 4;
    if (data[i + 3] < 16) return true;
    return colorDist(data, i, bgRef) < BG_DIST;
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

// After the border flood-fill, whatever opaque pixels remain should be exactly Zippy's body —
// one large connected blob. Anything else still standing (a stray sparkle glyph, a fragment of
// the watermark band that didn't touch the border) is a disconnected island; drop it too.
function keepLargestComponent(data, w, h) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const stack = [];
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < 16) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p / w) | 0;
      const neighbors = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (label[np] !== -1 || data[np * 4 + 3] < 16) continue;
        label[np] = id;
        stack.push(np);
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return; // nothing to discard
  let bestId = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[bestId]) bestId = i;
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] >= 16 && label[p] !== bestId) data[p * 4 + 3] = 0;
  }
}

// Zero RGB wherever alpha is now 0 — prevents any renderer/compressor from blending ghost color
// from the removed background into the visible edge (halo/fringe artifacts).
function zeroTransparentRgb(data) {
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 16) { data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0; }
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

    const { data, info } = await sharp(srcPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    const bgRef = sampleBackground(data, width, height);
    floodFillBackground(data, width, height, bgRef);
    keepLargestComponent(data, width, height);
    zeroTransparentRgb(data);

    // Lossless encoding: these images have flat fur-color regions + a hard alpha edge, exactly
    // the case where lossy WebP's alpha quantization produces visible blocking/dithering
    // ("checkerboard" artifacts) — lossless avoids that entirely and is still small at this size.
    const buf = await sharp(data, { raw: { width, height, channels: 4 } })
      .trim()
      .resize({ height: TARGET_H, fit: 'inside', withoutEnlargement: true })
      .webp({ lossless: true, effort: 6 })
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
