import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
// This exact licensed UMD is byte-identical to the already exempt Portal vendor.
// Its Unicode codepoint tables intentionally contain U+FFFD. Drift is scanned normally.
const VERIFIED_FONTKIT_PATH = 'packages/studio-documents/vendor/fontkit.umd.cjs';
const VERIFIED_FONTKIT_SHA256 = '15d1ce74a2e38a5ee280ff4910091d3c8d003d98fabfdbf85c34370d2e803dcd';

const SKIP_PREFIXES = [
  '.git/',
  '.next/',
  '.turbo/',
  'build/',
  'dist/',
  'node_modules/',
  'apps/portal/vendor/',
];

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.scss',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const RULES = [
  {
    name: 'suspicious e2-20ac mojibake sequence',
    re: /\u00E2\u20AC./g,
  },
  {
    name: 'suspicious e2-2020 mojibake sequence',
    re: /\u00E2\u2020./g,
  },
  {
    name: 'suspicious c3-d7/f7 mojibake sequence',
    re: /\u00C3[\u2014\u00B7]/g,
  },
  {
    name: 'suspicious c2-b0/b2/b7 mojibake sequence',
    re: /\u00C2[\u00B0\u00B2\u00B7]/g,
  },
  {
    name: 'unicode replacement character (U+FFFD)',
    re: /\uFFFD/g,
  },
];

function shouldSkip(relPath) {
  return SKIP_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isTextFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function getTrackedFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return raw.split('\0').filter(Boolean);
}

function lineAndColumnAt(text, index) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

const findings = [];

for (const relPath of getTrackedFiles()) {
  if (shouldSkip(relPath) || !isTextFile(relPath)) continue;

  const absPath = path.join(ROOT, relPath);
  let text;
  try {
    const bytes=fs.readFileSync(absPath);
    if (relPath === VERIFIED_FONTKIT_PATH
      && createHash('sha256').update(bytes).digest('hex') === VERIFIED_FONTKIT_SHA256) continue;
    text = bytes.toString('utf8');
  } catch {
    continue;
  }

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      const pos = lineAndColumnAt(text, match.index);
      findings.push({
        file: relPath,
        line: pos.line,
        col: pos.col,
        rule: rule.name,
        sample: match[0],
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Mojibake check failed: found suspicious text encoding artifacts.\n');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}:${finding.col} [${finding.rule}] sample="${finding.sample}"`);
  }
  process.exit(1);
}

console.log('mojibake-check: clean');
