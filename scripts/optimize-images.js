/* One-off image optimiser for public/images.
 * Usage:
 *   1) npm install
 *   2) npm run images:optimize
 *
 * Adjust MAX_DIMENSION and JPEG_QUALITY below if needed.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Conservative defaults for a visual site.
const MAX_DIMENSION = 3000; // max width or height in pixels
const JPEG_QUALITY = 85; // 0–100, higher = better quality/larger files

const ROOT_DIR = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.JPG',
  '.JPEG',
  '.PNG',
]);

function walkFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function optimiseImage(filePath) {
  const ext = path.extname(filePath);
  if (!IMAGE_EXTENSIONS.has(ext)) return;

  const relPath = path.relative(ROOT_DIR, filePath);

  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (err) {
    console.warn(`Skipping ${relPath}: could not read metadata (${err.message})`);
    return;
  }

  const { width, height, format, orientation } = metadata;
  if (!width || !height) {
    console.warn(`Skipping ${relPath}: unknown dimensions`);
    return;
  }

  const longest = Math.max(width, height);
  const needsResize = longest > MAX_DIMENSION;
  const needsOrientationFix = typeof orientation === 'number' && orientation !== 1;

  // If it’s already below our target, has normal orientation and is a JPEG/PNG, leave it alone.
  if (!needsResize && !needsOrientationFix && (format === 'jpeg' || format === 'png')) {
    console.log(`Skipping ${relPath}: already <= ${MAX_DIMENSION}px and orientation normal`);
    return;
  }

  const originalSize = fs.statSync(filePath).size;

  let pipeline = sharp(filePath);
  // Normalise EXIF orientation when required so pixels are stored upright.
  if (needsOrientationFix) {
    pipeline = pipeline.rotate();
  }
  if (needsResize) {
    if (width >= height) {
      pipeline = pipeline.resize({ width: MAX_DIMENSION });
    } else {
      pipeline = pipeline.resize({ height: MAX_DIMENSION });
    }
  }

  const lowerExt = ext.toLowerCase();
  if (lowerExt === '.jpg' || lowerExt === '.jpeg') {
    pipeline = pipeline.jpeg({
      quality: JPEG_QUALITY,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    });
  } else if (lowerExt === '.png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
      palette: true,
    });
  }

  let buffer;
  try {
    buffer = await pipeline.toBuffer();
  } catch (err) {
    console.warn(`Skipping ${relPath}: failed to process (${err.message})`);
    return;
  }

  // If optimisation didn’t reduce size and we didn’t resize or fix orientation, keep original.
  if (!needsResize && !needsOrientationFix && buffer.length >= originalSize * 0.98) {
    console.log(`Skipping ${relPath}: no meaningful size reduction`);
    return;
  }

  fs.writeFileSync(filePath, buffer);

  const beforeKb = Math.round(originalSize / 1024);
  const afterKb = Math.round(buffer.length / 1024);
  const change = beforeKb === 0 ? 0 : Math.round(((beforeKb - afterKb) / beforeKb) * 100);

  console.log(
    `Optimised ${relPath}: ${beforeKb}KB -> ${afterKb}KB (${change >= 0 ? '-' : ''}${change}%${
      needsResize ? ', resized' : ''
    })`
  );
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const files = walkFiles(IMAGES_DIR);
  const imageFiles = files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file)));

  console.log(`Found ${imageFiles.length} image(s) under public/images`);
  console.log(`Max dimension: ${MAX_DIMENSION}px, JPEG quality: ${JPEG_QUALITY}`);

  for (const file of imageFiles) {
    // eslint-disable-next-line no-await-in-loop
    await optimiseImage(file);
  }

  console.log('Image optimisation complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
