import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHANGED_ONLY = process.argv.includes('--changed');
const STRICT = process.argv.includes('--strict');
const MAX_ROWS = Number.parseInt(process.env.ROOT_COMPAT_MAX_ROWS ?? '80', 10);

const ROOT_COMPAT_DIRS = new Set(['app', 'components', 'data', 'lib', 'pages', 'src', 'styles']);
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'apps',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'docs',
  'node_modules',
  'out',
  'packages',
  'playwright-report',
  'public',
  'scripts',
  'supabase',
  'test-results',
  'tmp',
  'vendor',
]);
const CONFIG_FILE_RE =
  /(^|\/)(eslint\.config\.mjs|next\.config\.[cm]?[jt]s|package(-lock)?\.json|playwright\.config\.ts|postcss\.config\.mjs|tsconfig(\..*)?\.json|vitest\.config\.ts)$/;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function runGit(args) {
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

function walkFiles(relDir) {
  const absDir = path.join(ROOT, relDir);
  if (!fs.existsSync(absDir)) return [];

  const results = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const childRel = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...walkFiles(childRel));
    } else if (entry.isFile()) {
      results.push(childRel.replace(/^\.\//, ''));
    }
  }
  return results;
}

function isRootCompatPath(file) {
  if (CONFIG_FILE_RE.test(file)) return false;
  const [first] = file.split('/');
  return ROOT_COMPAT_DIRS.has(first);
}

function changedFiles() {
  const tracked = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked].map(toPosix))]
    .filter((file) => isRootCompatPath(file))
    .filter((file) => fs.existsSync(path.join(ROOT, file)));
}

function statusMap() {
  const map = new Map();
  for (const line of runGit(['status', '--short'])) {
    const status = line.slice(0, 2).trim() || 'modified';
    const rawPath = line.slice(3).trim();
    const file = toPosix(rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath);
    map.set(file, status === '??' ? 'new' : 'modified');
  }
  return map;
}

function lineCount(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function fileType(file) {
  const ext = path.posix.extname(file).toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'code';
  if (ext === '.css') return 'style';
  if (['.json', '.md', '.txt'].includes(ext)) return ext.slice(1);
  return ext ? ext.slice(1) : 'file';
}

function suggestedOwner(file) {
  if (file.startsWith('data/')) return 'apps/marketing data or package data owner';
  if (file.startsWith('styles/')) return 'app-local styles under apps/marketing or apps/portal';
  if (file.startsWith('src/config/')) return 'owning app config or package contract';
  if (/^components\/(portal|auth|diagnostics|estimates|layout|outputs|sync)\//.test(file)) return 'apps/portal';
  if (/^components\/(home|Gallery)\//.test(file)) return 'apps/marketing';
  if (/^components\/(Analytics|ArchiproPixel|Footer|Header|JsonLd|MetaPixel|Overlay|PageTransitions|Product|Projects|Scroll|Site|SpReveal|WebVitals)/.test(file)) {
    return 'apps/marketing';
  }
  if (/^lib\/(api|auth|automation|cache|costing|import|outputs|repo|scheduling|sync|types)\//.test(file)) return 'apps/portal or package owner';
  if (/^lib\/(email|emails|pricing|product|seo)/.test(file)) return 'apps/marketing or package owner';
  if (file.startsWith('lib/supabase')) return 'apps/portal server/client boundary or shared package if truly app-independent';
  if (file.startsWith('lib/utils')) return 'package or app-local utility owner';
  return 'apps/marketing, apps/portal, or packages/*';
}

function category(file, state) {
  if (state === 'new') return 'new-growth';
  if (CHANGED_ONLY) return 'changed';
  return 'legacy-compatible';
}

function actionFor(row) {
  if (row.category === 'new-growth') {
    return 'strong advisory: move into apps/marketing, apps/portal, or packages/*, or document why root is required';
  }
  if (row.category === 'changed') {
    return 'handoff note required: explain why this root compatibility path was touched and whether ownership moved';
  }
  return 'legacy compatibility: avoid growing; move toward suggested owner when touched';
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
}

function printRows(rows) {
  const widths = {
    category: Math.max('Category'.length, ...rows.map((row) => row.category.length)),
    state: Math.max('State'.length, ...rows.map((row) => row.state.length)),
    type: Math.max('Type'.length, ...rows.map((row) => row.type.length)),
    lines: Math.max('Lines'.length, ...rows.map((row) => String(row.lines).length)),
    owner: Math.max('Suggested owner'.length, ...rows.map((row) => row.owner.length)),
  };

  console.log(
    `${pad('Category', widths.category)}  ${pad('State', widths.state)}  ${pad('Type', widths.type)}  ${pad(
      'Lines',
      widths.lines,
    )}  ${pad('Suggested owner', widths.owner)}  File`,
  );
  console.log(
    `${'-'.repeat(widths.category)}  ${'-'.repeat(widths.state)}  ${'-'.repeat(widths.type)}  ${'-'.repeat(
      widths.lines,
    )}  ${'-'.repeat(widths.owner)}  ${'-'.repeat(40)}`,
  );

  for (const row of rows) {
    console.log(
      `${pad(row.category, widths.category)}  ${pad(row.state, widths.state)}  ${pad(row.type, widths.type)}  ${pad(
        row.lines,
        widths.lines,
      )}  ${pad(row.owner, widths.owner)}  ${row.file}`,
    );
    console.log(`${' '.repeat(widths.category + widths.state + widths.type + widths.lines + widths.owner + 10)}${row.action}`);
  }
}

function maybeFailStrict(rows) {
  if (!STRICT) return;

  const failures = rows.filter((row) => row.category === 'new-growth');
  if (failures.length === 0) return;

  console.error('');
  console.error('root-compatibility-report: strict changed-file check failed');
  console.error('New root compatibility files are blocked in strict mode. Move them into apps/marketing, apps/portal, or packages/*, or avoid creating the root file:');
  for (const row of failures) {
    console.error(`- ${row.file} (${row.type}, ${row.lines} lines; suggested owner: ${row.owner})`);
  }
  process.exit(1);
}

function main() {
  const states = statusMap();
  const files = CHANGED_ONLY
    ? changedFiles()
    : [...ROOT_COMPAT_DIRS].flatMap((dir) => walkFiles(dir)).filter((file) => isRootCompatPath(file));

  const rows = files
    .map((file) => {
      const state = states.get(file) ?? 'tracked';
      const row = {
        file,
        state,
        type: fileType(file),
        lines: lineCount(file),
        owner: suggestedOwner(file),
        category: category(file, state),
      };
      return { ...row, action: actionFor(row) };
    })
    .sort((a, b) => {
      const categoryWeight = { 'new-growth': 2, changed: 1, 'legacy-compatible': 0 };
      return categoryWeight[b.category] - categoryWeight[a.category] || b.lines - a.lines || a.file.localeCompare(b.file);
    });

  console.log(`root-compatibility-report: ${CHANGED_ONLY ? 'changed-file advisory report' : 'advisory report'}`);
  if (STRICT) console.log('Strict mode: enabled for new root compatibility files.');
  console.log('Root compatibility paths: app, components, data, lib, pages, src, styles.');
  console.log('Generated, workspace, docs, scripts, public, tmp, test output, and config-only files are skipped.');
  console.log('');

  if (rows.length === 0) {
    console.log(CHANGED_ONLY ? 'No changed root compatibility files detected.' : 'No root compatibility files detected.');
    return;
  }

  const newCount = rows.filter((row) => row.category === 'new-growth').length;
  const changedCount = rows.filter((row) => row.category === 'changed').length;
  const legacyCount = rows.filter((row) => row.category === 'legacy-compatible').length;
  console.log(`${newCount} new-growth file(s), ${changedCount} changed file(s), ${legacyCount} legacy-compatible file(s).`);
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set ROOT_COMPAT_MAX_ROWS to change this.`);
  console.log('');
  printRows(rows.slice(0, MAX_ROWS));

  if (CHANGED_ONLY) {
    console.log('');
    console.log('Handoff cue: if root compatibility files are listed, explain why the root path was touched and why it was not moved to apps/* or packages/* in this task.');
  }
  maybeFailStrict(rows);
}

main();
