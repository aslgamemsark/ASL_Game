// One-off build tool: rasterize scripts/icon-source.svg into the PNG app icons a PWA needs.
// Run with: node scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, 'icon-source.svg'), 'utf8');
const outDir = join(here, '..', 'public');

const targets = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 }, // iOS home-screen icon (opaque, full-bleed)
];

for (const { file, size } of targets) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(outDir, file), png);
  console.log(`wrote public/${file} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
