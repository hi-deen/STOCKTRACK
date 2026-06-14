import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const iconsDir = path.join(publicDir, 'icons');
const svgPath = path.join(rootDir, 'src', 'assets', 'icon.svg');

await mkdir(iconsDir, { recursive: true });

const svgBuffer = await sharp(svgPath).toBuffer();

await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile(path.join(iconsDir, 'icon-192.png'));

await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(path.join(iconsDir, 'icon-512.png'));

await sharp(svgBuffer)
  .resize(512, 512)
  .extend({
    top: 64,
    bottom: 64,
    left: 64,
    right: 64,
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toFile(path.join(iconsDir, 'icon-maskable-512.png'));

await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(path.join(publicDir, 'apple-touch-icon.png'));

console.log('Generated PWA icons');
