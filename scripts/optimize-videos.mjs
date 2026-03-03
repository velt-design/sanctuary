/* Video optimizer for apps/marketing/public/videos.
 *
 * Usage:
 *   npm run videos:optimize
 *
 * Optional environment overrides:
 *   FFMPEG_BIN=C:\ffmpeg\bin\ffmpeg.exe
 *   VIDEO_DRY_RUN=1
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const VIDEOS_DIR = path.join(ROOT_DIR, 'apps', 'marketing', 'public', 'videos');
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const DRY_RUN = process.env.VIDEO_DRY_RUN === '1';

/** @typedef {{ maxEdge: number; fps: number; crf: number; maxrateK: number; bufsizeK: number }} EncodeProfile */

/** @type {Record<string, EncodeProfile>} */
const PROFILE_BY_FILE = {
  'materials-acrylic.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 1800, bufsizeK: 3600 },
  'materials-timber.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 1800, bufsizeK: 3600 },
  'materials-combo.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 1800, bufsizeK: 3600 },
  'gable-sanctuary.mp4': { maxEdge: 1152, fps: 24, crf: 27, maxrateK: 2600, bufsizeK: 5200 },
  'gable-sanctuary-loop.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2000, bufsizeK: 4000 },
  'combination-gable.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2200, bufsizeK: 4400 },
  'hip-subtle-movement.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2000, bufsizeK: 4000 },
  'box-subtle-movement.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2000, bufsizeK: 4000 },
  'timber-pitched.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2200, bufsizeK: 4400 },
  'gable-acrylic.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2000, bufsizeK: 4000 },
  'gable-subtle-movement.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 2000, bufsizeK: 4000 },
  'pitched-subtle-movement.mp4': { maxEdge: 960, fps: 24, crf: 28, maxrateK: 1800, bufsizeK: 3600 },
};

function assertEnvironment() {
  if (!fs.existsSync(VIDEOS_DIR)) {
    throw new Error(`Video directory not found: ${VIDEOS_DIR}`);
  }
  if (!fs.existsSync(FFMPEG_BIN)) {
    throw new Error(`ffmpeg binary not found: ${FFMPEG_BIN}`);
  }
}

function toKb(bytes) {
  return Math.round(bytes / 1024);
}

function toPct(before, after) {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

function encodeVideo(inputPath, profile) {
  const tempPath = `${inputPath}.tmp.mp4`;
  const scaleFilter = `scale='if(gte(iw,ih),min(${profile.maxEdge},iw),-2)':'if(gte(iw,ih),-2,min(${profile.maxEdge},ih))':flags=lanczos,fps=${profile.fps},format=yuv420p`;

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-an',
    '-vf',
    scaleFilter,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(profile.crf),
    '-maxrate',
    `${profile.maxrateK}k`,
    '-bufsize',
    `${profile.bufsizeK}k`,
    '-movflags',
    '+faststart',
    tempPath,
  ];

  const result = spawnSync(FFMPEG_BIN, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw new Error(`ffmpeg failed for ${path.basename(inputPath)}`);
  }

  return tempPath;
}

function main() {
  assertEnvironment();

  /** @type {Array<{name: string; before: number; after: number}>} */
  const changes = [];

  for (const [name, profile] of Object.entries(PROFILE_BY_FILE)) {
    const inputPath = path.join(VIDEOS_DIR, name);
    if (!fs.existsSync(inputPath)) {
      console.warn(`Skipping missing file: ${name}`);
      continue;
    }

    const before = fs.statSync(inputPath).size;
    if (DRY_RUN) {
      console.log(`[dry-run] Would encode ${name} (${toKb(before)} KB)`);
      continue;
    }

    const tempPath = encodeVideo(inputPath, profile);
    const after = fs.statSync(tempPath).size;

    if (after < before) {
      fs.renameSync(tempPath, inputPath);
      changes.push({ name, before, after });
      console.log(
        `Optimized ${name}: ${toKb(before)} KB -> ${toKb(after)} KB (${toPct(before, after).toFixed(1)}% saved)`
      );
    } else {
      fs.unlinkSync(tempPath);
      console.log(`Kept original ${name}: output not smaller`);
    }
  }

  if (!DRY_RUN) {
    const totalBefore = changes.reduce((acc, c) => acc + c.before, 0);
    const totalAfter = changes.reduce((acc, c) => acc + c.after, 0);
    if (changes.length > 0) {
      console.log(
        `Total saved: ${(toPct(totalBefore, totalAfter)).toFixed(1)}% (${toKb(totalBefore - totalAfter)} KB)`
      );
    } else {
      console.log('No files were replaced.');
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
