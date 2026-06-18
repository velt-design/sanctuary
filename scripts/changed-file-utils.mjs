import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const ARCHITECTURE_CHANGED_BASE = process.env.ARCHITECTURE_CHANGED_BASE?.trim() || '';
const ARCHITECTURE_CHANGED_HEAD = process.env.ARCHITECTURE_CHANGED_HEAD?.trim() || '';
export const HAS_ARCHITECTURE_COMPARE = Boolean(ARCHITECTURE_CHANGED_BASE && ARCHITECTURE_CHANGED_HEAD);

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

function runGitLines(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function gitText(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function parseNameStatusPath(line) {
  const parts = line.split(/\t/).filter(Boolean);
  if (parts.length === 0) return null;
  const status = parts[0];
  const file = parts.at(-1);
  if (!file) return null;
  return {
    file: toPosix(file),
    state: status.startsWith('A') ? 'new' : 'modified',
  };
}

function parseShortStatusPath(line) {
  const status = line.slice(0, 2).trim() || 'modified';
  const rawPath = line.slice(3).trim();
  if (!rawPath) return null;
  return {
    file: toPosix(rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath),
    state: status === '??' ? 'new' : 'modified',
  };
}

export function changedFilesFromGit({ filter = () => true, requireExists = true } = {}) {
  const files = HAS_ARCHITECTURE_COMPARE
    ? runGitLines([
        'diff',
        '--name-only',
        '--diff-filter=ACMRTUXB',
        ARCHITECTURE_CHANGED_BASE,
        ARCHITECTURE_CHANGED_HEAD,
      ])
    : [
        ...runGitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']),
        ...runGitLines(['ls-files', '--others', '--exclude-standard']),
      ];

  return [...new Set(files.map(toPosix))]
    .filter(filter)
    .filter((file) => !requireExists || fs.existsSync(path.join(ROOT, file)));
}

export function changedStatusMap() {
  const map = new Map();
  const lines = HAS_ARCHITECTURE_COMPARE
    ? runGitLines([
        'diff',
        '--name-status',
        '--diff-filter=ACMRTUXB',
        ARCHITECTURE_CHANGED_BASE,
        ARCHITECTURE_CHANGED_HEAD,
      ])
    : runGitLines(['status', '--short']);

  for (const line of lines) {
    const parsed = HAS_ARCHITECTURE_COMPARE ? parseNameStatusPath(line) : parseShortStatusPath(line);
    if (parsed) map.set(parsed.file, parsed.state);
  }
  return map;
}

export function previousFileText(relPath) {
  const ref = HAS_ARCHITECTURE_COMPARE ? ARCHITECTURE_CHANGED_BASE : 'HEAD';
  return gitText(['show', `${ref}:${relPath}`]);
}

export function changedModeDescription() {
  if (!HAS_ARCHITECTURE_COMPARE) return 'local worktree vs HEAD';
  return `${ARCHITECTURE_CHANGED_BASE}..${ARCHITECTURE_CHANGED_HEAD}`;
}
