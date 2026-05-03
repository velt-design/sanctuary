import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  changedFilesFromGit,
  changedModeDescription,
  toPosix,
} from './changed-file-utils.mjs';

const ROOT = process.cwd();
const CHANGED_ONLY = process.argv.includes('--changed');
const MAX_ROWS = Number.parseInt(process.env.DEAD_CODE_MAX_ROWS ?? '80', 10);
const REGISTRY_PATH = 'scripts/dead-code-registry.json';
const VALID_CATEGORIES = new Set(['intentional-entrypoint', 'legacy-retirement', 'dynamic-reference']);
const VALID_STATUSES = new Set(['current', 'future', 'legacy']);

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

function walkRepoFiles(relDir = '.') {
  const absDir = path.join(ROOT, relDir);
  const results = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'playwright-report', 'test-results'].includes(entry.name)) continue;
    const childRel = toPosix(path.join(relDir, entry.name)).replace(/^\.\//, '');
    if (entry.isDirectory()) {
      results.push(...walkRepoFiles(childRel));
    } else if (entry.isFile()) {
      results.push(childRel);
    }
  }
  return results;
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRY_PATH), 'utf8'));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function validateRegistry(registry, repoFiles) {
  const failures = [];
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    return { entries: [], failures: [`${REGISTRY_PATH} must contain { "version": 1, "entries": [...] }`] };
  }

  const ids = new Set();
  const entries = registry.entries.map((entry, index) => {
    const location = `${REGISTRY_PATH} entry ${index + 1}`;
    if (!isNonEmptyString(entry.id)) failures.push(`${location} is missing id`);
    if (isNonEmptyString(entry.id) && ids.has(entry.id)) failures.push(`${location} duplicates id "${entry.id}"`);
    if (isNonEmptyString(entry.id)) ids.add(entry.id);
    if (!VALID_CATEGORIES.has(entry.category)) failures.push(`${location} must use category intentional-entrypoint, legacy-retirement, or dynamic-reference`);
    if (!VALID_STATUSES.has(entry.status)) failures.push(`${location} must use status current, future, or legacy`);
    if (!isNonEmptyString(entry.ownerArea)) failures.push(`${location} is missing ownerArea`);
    if (!isStringArray(entry.pathPatterns)) failures.push(`${location} is missing non-empty pathPatterns`);
    if (!isNonEmptyString(entry.reason)) failures.push(`${location} is missing reason`);
    if (!isNonEmptyString(entry.retirementAction)) failures.push(`${location} is missing retirementAction`);
    if (!isNonEmptyString(entry.proofCommand)) failures.push(`${location} is missing proofCommand`);

    const compiledPatterns = isStringArray(entry.pathPatterns)
      ? entry.pathPatterns.map((pattern) => ({ pattern, matcher: globToRegExp(pattern) }))
      : [];
    const matchesCurrentFile = compiledPatterns.some(({ matcher }) => repoFiles.some((file) => matcher.test(file)));
    if (entry.status === 'current' && !matchesCurrentFile) {
      failures.push(`${location} has current pathPatterns that match no repo files`);
    }

    return { ...entry, compiledPatterns };
  });

  return { entries, failures };
}

function registryEntryFor(file, entries) {
  return entries.find((entry) => entry.compiledPatterns.some(({ matcher }) => matcher.test(file))) ?? null;
}

function runKnipJson() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result =
    process.platform === 'win32'
      ? spawnSync('npm exec -- knip --reporter json --no-exit-code --no-progress', {
          cwd: ROOT,
          encoding: 'utf8',
          shell: true,
        })
      : spawnSync(npmCommand, ['exec', '--', 'knip', '--reporter', 'json', '--no-exit-code', '--no-progress'], {
          cwd: ROOT,
          encoding: 'utf8',
        });

  if (result.error) {
    console.error('dead-code-report: failed to run Knip');
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('dead-code-report: Knip failed before producing an advisory report');
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
    process.exit(result.status ?? 1);
  }

  try {
    return JSON.parse(result.stdout || '{}');
  } catch (error) {
    console.error('dead-code-report: could not parse Knip JSON output');
    if (result.stderr) console.error(result.stderr.trim());
    console.error(error.message);
    process.exit(1);
  }
}

function normalizeFile(file) {
  return toPosix(file || '').replace(/^\.\//, '');
}

function issueItems(issue, key) {
  return Array.isArray(issue?.[key]) ? issue[key] : [];
}

function rowsFromKnip(payload, registryEntries) {
  const rows = [];
  for (const file of Array.isArray(payload.files) ? payload.files : []) {
    const normalized = normalizeFile(file);
    const registry = registryEntryFor(normalized, registryEntries);
    rows.push({
      file: normalized,
      issue: 'unused-file',
      detail: 'file is not reached from configured entrypoints',
      classification: classificationFor(registry, 'unused-file', normalized),
      owner: registry?.ownerArea ?? 'unowned',
      proof: registry?.proofCommand ?? 'search references and run focused owner tests',
      action: registry?.retirementAction ?? 'prove unused, then delete or wire into the owning app/package',
    });
  }

  for (const issue of Array.isArray(payload.issues) ? payload.issues : []) {
    const file = normalizeFile(issue.file);
    for (const key of ['dependencies', 'devDependencies', 'optionalPeerDependencies', 'unlisted', 'binaries', 'unresolved', 'exports', 'types', 'duplicates']) {
      for (const item of issueItems(issue, key)) {
        const registry = registryEntryFor(file, registryEntries);
        rows.push({
          file,
          issue: key,
          detail: item.name || item.member || item.symbol || item.type || 'unnamed finding',
          classification: classificationFor(registry, key, file),
          owner: registry?.ownerArea ?? 'unowned',
          proof: registry?.proofCommand ?? 'search references and run focused owner tests',
          action: registry?.retirementAction ?? actionForIssue(key),
        });
      }
    }
  }
  return rows;
}

function classificationFor(registry, issue, file) {
  if (registry?.category === 'intentional-entrypoint') return 'intentional-entrypoint';
  if (registry?.category === 'legacy-retirement') return 'legacy-retirement';
  if (registry?.category === 'dynamic-reference') return 'needs-proof';
  if (isPotentialFrameworkOrGenerated(file)) return 'needs-proof';
  if (issue === 'unresolved' || issue === 'unlisted') return 'needs-proof';
  return 'delete-candidate';
}

function isPotentialFrameworkOrGenerated(file) {
  return (
    file.includes('/app/') ||
    file.includes('/generated/') ||
    file.endsWith('.config.ts') ||
    file.endsWith('.config.mjs') ||
    file.startsWith('playwright/')
  );
}

function actionForIssue(issue) {
  if (issue === 'dependencies' || issue === 'devDependencies' || issue === 'optionalPeerDependencies') {
    return 'remove dependency only after package scripts, builds, and focused tests prove it unused';
  }
  if (issue === 'unlisted') return 'declare the dependency in the owning package or remove the import';
  if (issue === 'exports' || issue === 'types') return 'remove export only after confirming it is not public API or dynamically consumed';
  if (issue === 'duplicates') return 'dedupe package declarations after confirming workspace ownership';
  return 'prove unused, then delete or wire into the owning app/package';
}

function changedSet() {
  return new Set(changedFilesFromGit({ requireExists: false }).map(normalizeFile));
}

function filterChangedRows(rows) {
  const changed = changedSet();
  return rows.filter((row) => changed.has(row.file));
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
}

function printRows(rows) {
  const widths = {
    classification: Math.max('Classification'.length, ...rows.map((row) => row.classification.length)),
    issue: Math.max('Issue'.length, ...rows.map((row) => row.issue.length)),
    owner: Math.max('Owner'.length, ...rows.map((row) => row.owner.length)),
  };

  console.log(`${pad('Classification', widths.classification)}  ${pad('Issue', widths.issue)}  ${pad('Owner', widths.owner)}  File`);
  console.log(`${'-'.repeat(widths.classification)}  ${'-'.repeat(widths.issue)}  ${'-'.repeat(widths.owner)}  ${'-'.repeat(40)}`);
  for (const row of rows) {
    console.log(`${pad(row.classification, widths.classification)}  ${pad(row.issue, widths.issue)}  ${pad(row.owner, widths.owner)}  ${row.file}`);
    console.log(`${' '.repeat(widths.classification + widths.issue + widths.owner + 6)}${row.detail}`);
    console.log(`${' '.repeat(widths.classification + widths.issue + widths.owner + 6)}${row.action}`);
  }
}

function printCounts(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${counts['delete-candidate'] ?? 0} delete-candidate, ${counts['legacy-retirement'] ?? 0} legacy-retirement, ${
      counts['intentional-entrypoint'] ?? 0
    } intentional-entrypoint, ${counts['needs-proof'] ?? 0} needs-proof finding(s).`,
  );
}

function main() {
  const registry = validateRegistry(readRegistry(), walkRepoFiles());
  if (registry.failures.length > 0) {
    console.error('dead-code-report: registry validation failed');
    for (const failure of registry.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const payload = runKnipJson();
  const allRows = rowsFromKnip(payload, registry.entries).sort((a, b) => {
    const weight = { 'delete-candidate': 3, 'legacy-retirement': 2, 'needs-proof': 1, 'intentional-entrypoint': 0 };
    return weight[b.classification] - weight[a.classification] || a.file.localeCompare(b.file) || a.issue.localeCompare(b.issue);
  });
  const rows = CHANGED_ONLY ? filterChangedRows(allRows) : allRows;

  console.log(`dead-code-report: ${CHANGED_ONLY ? 'changed-file advisory report' : 'advisory report'}`);
  if (CHANGED_ONLY) console.log(`Changed source: ${changedModeDescription()}`);
  console.log(`Registry: ${REGISTRY_PATH} (${registry.entries.length} entries)`);
  console.log('Powered by Knip. This report is advisory and does not delete code.');
  console.log('');

  if (rows.length === 0) {
    console.log(CHANGED_ONLY ? 'No changed files are currently reported by Knip.' : 'No dead-code findings reported by Knip.');
    return;
  }

  printCounts(rows);
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set DEAD_CODE_MAX_ROWS to change this.`);
  console.log('');
  printRows(rows.slice(0, MAX_ROWS));
  console.log('');
  if (CHANGED_ONLY) {
    console.log('Handoff cue: if a touched or new file is listed, say whether it was deleted, wired into the owner, or intentionally deferred with registry coverage.');
  }
  console.log('Deletion rule: prove unused with static report, search, owner-doc review, and focused tests before removing code.');
}

main();
