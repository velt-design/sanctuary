import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CODE_FILE_RE = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'playwright-report',
  'public',
  'test-results',
  'vendor',
]);
const MAX_ROWS = Number.parseInt(process.env.FILES_REPORT_MAX_ROWS ?? '40', 10);
const CHANGED_ONLY = process.argv.includes('--changed');
const STRICT = process.argv.includes('--strict') || process.env.FILES_REPORT_STRICT === '1';
const REGISTRY_PATH = 'scripts/file-decomposition-registry.json';

const THRESHOLDS = {
  'component/page': { warning: 800, critical: 1200 },
  'route/domain/package': { warning: 700, critical: 1200 },
  test: { warning: 1200, critical: 2500 },
  code: { warning: 700, critical: 1200 },
};

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

function walkFiles(relDir) {
  const absDir = path.join(ROOT, relDir);
  const results = [];

  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const childRel = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...walkFiles(childRel));
    } else if (entry.isFile() && CODE_FILE_RE.test(entry.name)) {
      results.push(childRel);
    }
  }

  return results;
}

function isSkippedPath(file) {
  return file.split('/').some((part) => SKIP_DIRS.has(part));
}

function codeFiles() {
  return walkFiles('.').map((file) => file.replace(/^\.\//, ''));
}

function globToRegExp(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function readRegistry() {
  const registryPath = path.join(ROOT, REGISTRY_PATH);
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function validateString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(validateString);
}

function validateRegistry(registry, allCodeFiles) {
  const failures = [];
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    failures.push(`${REGISTRY_PATH} must contain { "version": 1, "entries": [...] }`);
    return { entries: [], failures };
  }

  const ids = new Set();
  const validStatuses = new Set(['current', 'future', 'legacy']);
  const entries = registry.entries.map((entry, index) => {
    const location = `${REGISTRY_PATH} entry ${index + 1}`;
    if (!validateString(entry.id)) failures.push(`${location} is missing id`);
    if (ids.has(entry.id)) failures.push(`${location} duplicates id "${entry.id}"`);
    if (validateString(entry.id)) ids.add(entry.id);
    if (!validateString(entry.label)) failures.push(`${location} is missing label`);
    if (!validStatuses.has(entry.status)) failures.push(`${location} must use status current, future, or legacy`);
    if (!validateString(entry.ownerArea)) failures.push(`${location} is missing ownerArea`);
    if (!validateStringArray(entry.pathPatterns)) failures.push(`${location} is missing non-empty pathPatterns`);
    if (!validateString(entry.whyLarge)) failures.push(`${location} is missing whyLarge`);
    if (!validateString(entry.nextSafeExtraction)) failures.push(`${location} is missing nextSafeExtraction`);
    if (!validateStringArray(entry.focusedTests)) failures.push(`${location} is missing focusedTests`);

    const compiledPatterns = validateStringArray(entry.pathPatterns)
      ? entry.pathPatterns.map((pattern) => ({ pattern, matcher: globToRegExp(pattern) }))
      : [];
    const matchesCurrentFile = compiledPatterns.some(({ matcher }) => allCodeFiles.some((file) => matcher.test(file)));
    if (entry.status === 'current' && !matchesCurrentFile) {
      failures.push(`${location} has current pathPatterns that match no code files`);
    }

    return {
      ...entry,
      compiledPatterns,
    };
  });

  return { entries, failures };
}

function changedFiles() {
  const tracked = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked].map(toPosix))]
    .filter((file) => CODE_FILE_RE.test(file))
    .filter((file) => !isSkippedPath(file))
    .filter((file) => fs.existsSync(path.join(ROOT, file)));
}

function countLines(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function lineCount(relPath) {
  return countLines(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function headLineCount(relPath) {
  const output = gitText(['show', `HEAD:${relPath}`]);
  if (output === null) return null;
  return countLines(output);
}

function isTestPath(file) {
  return /(^|\/)__tests__\//.test(file) || /\.(test|spec)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(file);
}

function categoryFor(file) {
  if (isTestPath(file)) return 'test';

  const basename = path.posix.basename(file);
  const isRoute = file.includes('/app/api/') || basename === 'route.ts' || basename === 'route.tsx';
  if (isRoute || file.startsWith('packages/') || file.includes('/lib/') || file.startsWith('scripts/')) {
    return 'route/domain/package';
  }

  if (/\.(jsx|tsx)$/.test(file) && (file.includes('/components/') || file.includes('/app/'))) {
    return 'component/page';
  }

  return 'code';
}

function bandFor(lines, thresholds) {
  if (lines >= thresholds.critical) return 'critical';
  if (lines >= thresholds.warning) return 'warning';
  return 'ok';
}

function registryEntryFor(file, registryEntries) {
  return registryEntries.find((entry) => entry.compiledPatterns.some(({ matcher }) => matcher.test(file))) ?? null;
}

function suggestedAction(row) {
  if (CHANGED_ONLY && row.band === 'critical' && row.delta > 0) {
    return 'critical file grew; extract a cohesive owner or update the decomposition registry note';
  }
  if (row.band === 'critical') return 'name owner and decomposition plan before major feature work';
  if (row.band === 'warning') return 'prefer extracting a cohesive owner before adding responsibility';
  return 'monitor';
}

function formatDelta(delta) {
  if (delta === null) return 'new';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
}

function printTable(rows) {
  const widths = {
    band: Math.max('Band'.length, ...rows.map((row) => row.band.length)),
    lines: Math.max('Lines'.length, ...rows.map((row) => String(row.lines).length)),
    headLines: CHANGED_ONLY ? Math.max('HEAD'.length, ...rows.map((row) => String(row.headLines ?? '-').length)) : 0,
    delta: CHANGED_ONLY ? Math.max('Delta'.length, ...rows.map((row) => formatDelta(row.delta).length)) : 0,
    category: Math.max('Category'.length, ...rows.map((row) => row.category.length)),
    hotspot: Math.max('Hotspot'.length, ...rows.map((row) => row.hotspot.length)),
  };

  const changedColumns = CHANGED_ONLY ? `  ${pad('HEAD', widths.headLines)}  ${pad('Delta', widths.delta)}` : '';
  console.log(`${pad('Band', widths.band)}  ${pad('Lines', widths.lines)}${changedColumns}  ${pad('Category', widths.category)}  ${pad('Hotspot', widths.hotspot)}  File`);
  console.log(`${'-'.repeat(widths.band)}  ${'-'.repeat(widths.lines)}${CHANGED_ONLY ? `  ${'-'.repeat(widths.headLines)}  ${'-'.repeat(widths.delta)}` : ''}  ${'-'.repeat(widths.category)}  ${'-'.repeat(widths.hotspot)}  ${'-'.repeat(40)}`);

  for (const row of rows) {
    const changedValues = CHANGED_ONLY
      ? `  ${pad(row.headLines ?? '-', widths.headLines)}  ${pad(formatDelta(row.delta), widths.delta)}`
      : '';
    console.log(`${pad(row.band, widths.band)}  ${pad(row.lines, widths.lines)}${changedValues}  ${pad(row.category, widths.category)}  ${pad(row.hotspot || '-', widths.hotspot)}  ${row.file}`);
    console.log(`${' '.repeat(widths.band + widths.lines + widths.headLines + widths.delta + widths.category + widths.hotspot + (CHANGED_ONLY ? 12 : 8))}${row.action}`);
  }
}

function buildRows(files, registryEntries) {
  return files
    .map((file) => {
      const normalized = file.replace(/^\.\//, '');
      const category = categoryFor(normalized);
      const lines = lineCount(normalized);
      const headLines = CHANGED_ONLY ? headLineCount(normalized) : null;
      const delta = CHANGED_ONLY && headLines !== null ? lines - headLines : CHANGED_ONLY ? null : 0;
      const band = bandFor(lines, THRESHOLDS[category]);
      const registryEntry = registryEntryFor(normalized, registryEntries);
      return {
        file: normalized,
        category,
        lines,
        headLines,
        delta,
        band,
        hotspot: registryEntry?.label ?? '',
        registered: Boolean(registryEntry),
      };
    })
    .filter((row) => row.band !== 'ok' || CHANGED_ONLY)
    .sort((a, b) => {
      const bandWeight = { critical: 2, warning: 1, ok: 0 };
      return bandWeight[b.band] - bandWeight[a.band] || b.lines - a.lines || a.file.localeCompare(b.file);
    })
    .map((row) => ({ ...row, action: suggestedAction(row) }));
}

function printChangedHandoffCue(rows) {
  const riskyRows = rows.filter((row) => row.band === 'warning' || row.band === 'critical');
  if (riskyRows.length === 0) {
    console.log('Handoff cue: no touched warning or critical code files detected.');
    return;
  }

  console.log('Handoff cue: touched warning or critical files detected.');
  console.log('In the final response, say whether decomposition was done, deferred, or not relevant for these files.');

  const growingCritical = riskyRows.filter((row) => row.band === 'critical' && row.delta !== null && row.delta > 0);
  if (growingCritical.length > 0) {
    console.log('Critical growth cue: at least one touched critical file grew.');
    console.log('Extract a cohesive owner where safe, or update the decomposition registry with the next safe split.');
  }
}

function maybeFailStrict(rows) {
  if (!STRICT) return;

  const failures = rows.filter((row) => row.band === 'critical' && !row.registered);
  if (failures.length === 0) return;

  console.error('');
  console.error('file-decomposition-report: strict changed-file check failed');
  console.error('Touched critical files need a decomposition registry note in docs/file-decomposition-and-ownership.md:');
  for (const row of failures) {
    console.error(`- ${row.file} (${row.lines} lines, ${row.category})`);
  }
  process.exit(1);
}

function main() {
  const files = CHANGED_ONLY ? changedFiles() : codeFiles();
  const scanFiles = files
    .filter((file) => CODE_FILE_RE.test(file))
    .filter((file) => !isSkippedPath(file));
  const allCodeFiles = codeFiles();
  const registry = validateRegistry(readRegistry(), allCodeFiles);
  if (registry.failures.length > 0) {
    console.error('file-decomposition-report: registry validation failed');
    for (const failure of registry.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  const rows = buildRows(scanFiles, registry.entries);

  console.log(`file-decomposition-report: ${CHANGED_ONLY ? 'changed-file advisory report' : 'advisory report'}`);
  if (STRICT) console.log('Strict mode: enabled for changed critical files without a registered decomposition note.');
  console.log(`Registry: ${REGISTRY_PATH} (${registry.entries.length} entries)`);
  console.log(`Scanned ${scanFiles.length} code files. Generated, vendor, public, and build outputs are skipped.`);
  console.log('Thresholds: component/page 800/1200, route/domain/package 700/1200, test 1200/2500 lines.');
  console.log('');

  if (rows.length === 0) {
    console.log(CHANGED_ONLY ? 'No changed code files found.' : 'No warning or critical files found.');
    return;
  }

  const criticalCount = rows.filter((row) => row.band === 'critical').length;
  const warningCount = rows.filter((row) => row.band === 'warning').length;
  const okCount = rows.filter((row) => row.band === 'ok').length;
  console.log(`${criticalCount} critical file(s), ${warningCount} warning file(s)${CHANGED_ONLY ? `, ${okCount} ok changed file(s)` : ''}.`);
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set FILES_REPORT_MAX_ROWS to change this.`);
  console.log('');
  printTable(rows.slice(0, MAX_ROWS));
  console.log('');
  if (CHANGED_ONLY) printChangedHandoffCue(rows);
  console.log('This report is advisory unless --strict is enabled. Use docs/file-decomposition-and-ownership.md before expanding these files.');
  maybeFailStrict(rows);
}

main();
