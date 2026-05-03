import fs from 'node:fs';
import path from 'node:path';
import {
  changedFilesFromGit,
  changedModeDescription,
  changedStatusMap,
  toPosix,
} from './changed-file-utils.mjs';

const ROOT = process.cwd();
const CHANGED_ONLY = process.argv.includes('--changed');
const STRICT = process.argv.includes('--strict');
const MAX_ROWS = Number.parseInt(process.env.BROWSER_SUPABASE_MAX_ROWS ?? '80', 10);
const CODE_FILE_RE = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const TEST_FILE_RE = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public', 'test-results', 'vendor']);
const SCAN_ROOTS = ['apps/portal', 'apps/marketing', 'components', 'lib'].filter((relPath) =>
  fs.existsSync(path.join(ROOT, relPath)),
);

const SIGNALS = [
  { name: 'browserClient import', re: /from\s+['"][^'"]*\/supabase\/browserClient['"]/ },
  { name: 'getSupabaseBrowser', re: /\bgetSupabaseBrowser\b/ },
  { name: 'createBrowserClient', re: /\bcreateBrowserClient\b/ },
  { name: 'Supabase createClient', re: /\bcreateClient\b[\s\S]*?from\s+['"]@supabase\/(?:supabase-js|ssr)['"]|from\s+['"]@supabase\/(?:supabase-js|ssr)['"][\s\S]*?\bcreateClient\b/ },
  { name: 'table access', re: /\.from\s*\(\s*['"`]/ },
];

function walkFiles(relDir) {
  const absDir = path.join(ROOT, relDir);
  const results = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const childRel = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...walkFiles(childRel));
    } else if (entry.isFile() && CODE_FILE_RE.test(entry.name) && !TEST_FILE_RE.test(childRel)) {
      results.push(childRel);
    }
  }
  return results;
}

function changedFiles() {
  return changedFilesFromGit({
    filter: (file) =>
      CODE_FILE_RE.test(file) &&
      !TEST_FILE_RE.test(file) &&
      SCAN_ROOTS.some((root) => file === root || file.startsWith(`${root}/`)),
  });
}

function statusMap() {
  return changedStatusMap();
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function hasUseClientDirective(text) {
  return text
    .split(/\r?\n/)
    .slice(0, 8)
    .some((line) => /^\s*['"]use client['"];?\s*$/.test(line));
}

function isBrowserFacingHelper(file) {
  return (
    file.includes('/supabase/browserClient.') ||
    file.includes('/lib/repo/') ||
    file.includes('/lib/cache/') ||
    file.includes('/lib/localFirst/') ||
    file.includes('/components/sync/') ||
    file.includes('/components/spreadsheet/') ||
    file.includes('/lib/queries/')
  );
}

function shouldScanFile(file, text) {
  if (file.includes('/app/api/') || file.includes('/app/actions.')) return false;
  if (file.includes('/app/') && /\/route\.(ts|tsx|js|jsx)$/.test(file)) return false;
  return hasUseClientDirective(text) || isBrowserFacingHelper(file);
}

function signalsFor(text) {
  return SIGNALS.filter((signal) => signal.re.test(text)).map((signal) => signal.name);
}

function isApprovedAdapterPath(file, signals) {
  if (file.includes('/supabase/browserClient.')) return true;
  if (file.includes('/components/auth/') || file.endsWith('/app/login/LoginClient.tsx')) return true;
  if (file.includes('/lib/cache/')) return true;
  if (file.includes('/lib/localFirst/')) return true;
  if (file.includes('/components/sync/')) return true;
  if (file.includes('/components/spreadsheet/')) return true;
  if (file.includes('/lib/queries/')) return true;
  return signals.includes('browserClient import') && !signals.includes('getSupabaseBrowser') && !signals.includes('table access');
}

function suggestedOwner(file, category) {
  if (category === 'approved-adapter') return 'keep in approved adapter; do not expand table access casually';
  if (file.includes('/components/auth/') || file.endsWith('/app/login/LoginClient.tsx')) return 'auth/session browser adapter, not table access';
  if (file.includes('/lib/repo/')) return 'staff API, query helper, or local-first adapter';
  if (file.includes('/components/') || file.includes('/app/')) return 'staff API route, query hook, local-first mutation, or approved spreadsheet adapter';
  return 'owning app/server helper or package boundary';
}

function categoryFor(file, state, signals) {
  if (state === 'new') return 'new-growth';
  if (CHANGED_ONLY && state === 'modified') return 'changed';
  if (isApprovedAdapterPath(file, signals)) return 'approved-adapter';
  return 'legacy-direct';
}

function isStrictAllowed(file, signals) {
  return isApprovedAdapterPath(file, signals);
}

function actionFor(row) {
  if (row.category === 'new-growth') {
    return 'strong advisory: move to staff API, query helper, local-first mutation, or approved adapter unless explicitly justified';
  }
  if (row.category === 'changed') {
    return 'handoff note required: explain whether this expands direct browser Supabase access or only preserves a legacy path';
  }
  if (row.category === 'approved-adapter') {
    return 'approved adapter surface: keep scope narrow and avoid adding unrelated table access';
  }
  return 'legacy direct access: do not expand; prefer migration toward API/query/local-first layers';
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
    signals: Math.max('Signal'.length, ...rows.map((row) => row.signals.join(', ').length)),
    owner: Math.max('Suggested target'.length, ...rows.map((row) => row.owner.length)),
  };

  console.log(`${pad('Category', widths.category)}  ${pad('State', widths.state)}  ${pad('Signal', widths.signals)}  ${pad('Suggested target', widths.owner)}  File`);
  console.log(`${'-'.repeat(widths.category)}  ${'-'.repeat(widths.state)}  ${'-'.repeat(widths.signals)}  ${'-'.repeat(widths.owner)}  ${'-'.repeat(40)}`);

  for (const row of rows) {
    console.log(
      `${pad(row.category, widths.category)}  ${pad(row.state, widths.state)}  ${pad(row.signals.join(', '), widths.signals)}  ${pad(row.owner, widths.owner)}  ${row.file}`,
    );
    console.log(`${' '.repeat(widths.category + widths.state + widths.signals + widths.owner + 8)}${row.action}`);
  }
}

function maybeFailStrict(rows) {
  if (!STRICT) return;

  const failures = rows.filter((row) => row.state === 'new' && !row.strictAllowed);
  if (failures.length === 0) return;

  console.error('');
  console.error('browser-supabase-access-report: strict changed-file check failed');
  console.error('New browser-facing Supabase access is blocked in strict mode unless it is an approved adapter. Use a staff API, query helper, local-first mutation, or approved adapter:');
  for (const row of failures) {
    console.error(`- ${row.file} (${row.signals.join(', ')}; suggested target: ${row.owner})`);
  }
  process.exit(1);
}

function main() {
  const states = statusMap();
  const files = CHANGED_ONLY ? changedFiles() : SCAN_ROOTS.flatMap((root) => walkFiles(root));
  const rows = files
    .map((file) => {
      const text = read(file);
      if (!shouldScanFile(file, text)) return null;
      const signals = signalsFor(text);
      if (signals.length === 0) return null;
      const state = states.get(file) ?? 'tracked';
      const category = categoryFor(file, state, signals);
      const row = {
        file,
        state,
        signals,
        category,
        strictAllowed: isStrictAllowed(file, signals),
        owner: suggestedOwner(file, category),
      };
      return { ...row, action: actionFor(row) };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const weight = { 'new-growth': 3, changed: 2, 'legacy-direct': 1, 'approved-adapter': 0 };
      return weight[b.category] - weight[a.category] || a.file.localeCompare(b.file);
    });

  console.log(`browser-supabase-access-report: ${CHANGED_ONLY ? 'changed-file advisory report' : 'advisory report'}`);
  if (STRICT) console.log('Strict mode: enabled for new browser-facing Supabase access outside approved adapters.');
  if (CHANGED_ONLY) console.log(`Changed source: ${changedModeDescription()}`);
  console.log('This is broader than cache:forbid: it inventories browser-facing Supabase access but does not fail.');
  console.log('');

  if (rows.length === 0) {
    console.log(CHANGED_ONLY ? 'No changed browser Supabase access detected.' : 'No browser Supabase access detected.');
    return;
  }

  const counts = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${counts['new-growth'] ?? 0} new-growth, ${counts.changed ?? 0} changed, ${counts['legacy-direct'] ?? 0} legacy-direct, ${
      counts['approved-adapter'] ?? 0
    } approved-adapter finding(s).`,
  );
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set BROWSER_SUPABASE_MAX_ROWS to change this.`);
  console.log('');
  printRows(rows.slice(0, MAX_ROWS));

  if (CHANGED_ONLY) {
    console.log('');
    console.log('Handoff cue: if changed browser Supabase access is listed, explain whether it was migrated, preserved, or intentionally deferred.');
  }
  maybeFailStrict(rows);
}

main();
