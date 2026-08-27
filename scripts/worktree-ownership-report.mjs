import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHANGED_ONLY = process.argv.includes('--changed');
const STRICT = process.argv.includes('--strict');
const BASE_REF = process.env.WORKTREE_BASE_REF?.trim() || 'HEAD';
const HEAD_REF = process.env.WORKTREE_HEAD_REF?.trim() || '';
const OWNER_PATTERNS = (process.env.WORKTREE_OWNER_PATTERNS || '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean);
const MAX_ROWS = Number.parseInt(process.env.WORKTREE_OWNERSHIP_MAX_ROWS || '120', 10);

function toPosix(value) {
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

function ownerMatchers() {
  return OWNER_PATTERNS.map((pattern) => ({ pattern, matcher: globToRegExp(pattern) }));
}

function parseNameStatus(line) {
  const parts = line.split(/\t/).filter(Boolean);
  if (parts.length < 2) return null;
  const rawStatus = parts[0];
  const file = toPosix(parts.at(-1));
  const previousFile = rawStatus.startsWith('R') || rawStatus.startsWith('C') ? toPosix(parts[1]) : '';
  return {
    file,
    previousFile,
    state: stateFromNameStatus(rawStatus),
    rawStatus,
  };
}

function stateFromNameStatus(status) {
  if (status.startsWith('A')) return 'new';
  if (status.startsWith('D')) return 'deleted';
  if (status.startsWith('R')) return 'renamed';
  if (status.startsWith('C')) return 'copied';
  if (status.startsWith('T')) return 'typechanged';
  return 'modified';
}

function trackedChanges() {
  const refs = HEAD_REF ? [`${BASE_REF}...${HEAD_REF}`] : [BASE_REF];
  return runGitLines(['diff', '--name-status', '--diff-filter=ACMRTUXBD', ...refs])
    .map(parseNameStatus)
    .filter(Boolean);
}

function untrackedChanges(existingFiles) {
  if (HEAD_REF) return [];
  return runGitLines(['ls-files', '--others', '--exclude-standard'])
    .map(toPosix)
    .filter((file) => !existingFiles.has(file))
    .map((file) => ({
      file,
      previousFile: '',
      state: 'new',
      rawStatus: '??',
    }));
}

function changedRows() {
  const tracked = trackedChanges();
  const existing = new Set(tracked.map((row) => row.file));
  const rows = [...tracked, ...untrackedChanges(existing)];
  const matchers = ownerMatchers();

  return rows
    .map((row) => {
      const exists = fs.existsSync(path.join(ROOT, row.file));
      const category = categoryFor(row, exists, matchers);
      return {
        ...row,
        exists,
        category,
        ownerPattern: matchedOwnerPattern(row.file, matchers),
        action: actionFor(category),
      };
    })
    .sort((a, b) => {
      const weight = { 'outside-lane': 3, 'deleted-or-missing': 2, unclaimed: 1, owned: 0 };
      return weight[b.category] - weight[a.category] || a.file.localeCompare(b.file);
    });
}

function matchedOwnerPattern(file, matchers) {
  return matchers.find(({ matcher }) => matcher.test(file))?.pattern || '';
}

function categoryFor(row, exists, matchers) {
  if (!exists || row.state === 'deleted') return 'deleted-or-missing';
  if (matchers.length === 0) return 'unclaimed';
  return matchedOwnerPattern(row.file, matchers) ? 'owned' : 'outside-lane';
}

function actionFor(category) {
  if (category === 'owned') return 'inside declared lane; keep handoff scoped to this owner';
  if (category === 'outside-lane') return 'strong cue: do not edit, format, revert, or clean up; mention as unrelated dirty work if needed';
  if (category === 'deleted-or-missing') return 'review carefully; deletion or missing path needs explicit owner confirmation';
  return 'declare WORKTREE_OWNER_PATTERNS for non-trivial or parallel work';
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
    rawStatus: Math.max('Git'.length, ...rows.map((row) => row.rawStatus.length)),
    owner: Math.max('Owner pattern'.length, ...rows.map((row) => (row.ownerPattern || '-').length)),
  };

  console.log(`${pad('Category', widths.category)}  ${pad('State', widths.state)}  ${pad('Git', widths.rawStatus)}  ${pad('Owner pattern', widths.owner)}  File`);
  console.log(`${'-'.repeat(widths.category)}  ${'-'.repeat(widths.state)}  ${'-'.repeat(widths.rawStatus)}  ${'-'.repeat(widths.owner)}  ${'-'.repeat(40)}`);

  for (const row of rows) {
    const fileLabel = row.previousFile ? `${row.previousFile} -> ${row.file}` : row.file;
    console.log(`${pad(row.category, widths.category)}  ${pad(row.state, widths.state)}  ${pad(row.rawStatus, widths.rawStatus)}  ${pad(row.ownerPattern || '-', widths.owner)}  ${fileLabel}`);
    console.log(`${' '.repeat(widths.category + widths.state + widths.rawStatus + widths.owner + 8)}${row.action}`);
  }
}

function printHandoffCue(rows) {
  const outsideLaneCount = rows.filter((row) => row.category === 'outside-lane').length;
  const missingCount = rows.filter((row) => row.category === 'deleted-or-missing').length;

  if (OWNER_PATTERNS.length === 0 && rows.length > 0) {
    console.log('Handoff cue: no WORKTREE_OWNER_PATTERNS were declared. For parallel work, declare the lane before editing.');
  }

  if (outsideLaneCount > 0) {
    console.log('Outside-lane cue: changed files exist outside the declared lane.');
    console.log('Do not edit, format, revert, or clean up outside-lane files. Mention them only as unrelated worktree changes intentionally left untouched.');
  }

  if (missingCount > 0) {
    console.log('Deletion cue: deleted or missing paths require explicit owner confirmation before handoff.');
  }
}

function strictFailures(rows) {
  const failures = [];
  if (OWNER_PATTERNS.length === 0 && rows.length > 0) {
    failures.push({
      reason: 'missing-owner-patterns',
      message: 'declare WORKTREE_OWNER_PATTERNS before running strict worktree verification',
    });
  }

  for (const row of rows) {
    if (row.category === 'outside-lane') {
      failures.push({
        reason: 'outside-lane',
        file: row.file,
        message: 'changed file is outside WORKTREE_OWNER_PATTERNS',
      });
    }
    if (row.category === 'deleted-or-missing') {
      failures.push({
        reason: 'deleted-or-missing',
        file: row.file,
        message: 'deleted or missing path needs explicit owner confirmation',
      });
    }
  }
  return failures;
}

function printStrictFailures(failures) {
  if (failures.length === 0) return;
  console.log('');
  console.log('Strict failure: worktree ownership requirements were not met.');
  for (const failure of failures) {
    const fileLabel = failure.file ? `${failure.file}: ` : '';
    console.log(`- ${fileLabel}${failure.message}`);
  }
  console.log('Expected fix: declare the current lane with WORKTREE_OWNER_PATTERNS, move unrelated edits out of this handoff, or get explicit owner confirmation for deletions.');
}

function main() {
  const rows = changedRows();

  if (STRICT && rows.length === 0) return;

  console.log(
    `worktree-ownership-report: ${CHANGED_ONLY ? 'changed-file' : 'full'} ${
      STRICT ? 'strict report' : 'advisory report'
    }`,
  );
  console.log(HEAD_REF ? `Compared refs: ${BASE_REF}...${HEAD_REF}` : `Base ref: ${BASE_REF}`);
  console.log(`Owner patterns: ${OWNER_PATTERNS.length > 0 ? OWNER_PATTERNS.join(', ') : 'none declared'}`);
  console.log(STRICT ? 'Strict mode fails on undeclared lanes, outside-lane files, and deleted/missing paths.' : 'This report is advisory and does not modify the worktree.');
  console.log('');

  if (rows.length === 0) {
    if (!CHANGED_ONLY) console.log('No changed tracked or untracked files detected.');
    return;
  }

  const counts = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `${counts.owned || 0} owned, ${counts.unclaimed || 0} unclaimed, ${counts['outside-lane'] || 0} outside-lane, ${
      counts['deleted-or-missing'] || 0
    } deleted-or-missing file(s).`,
  );
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set WORKTREE_OWNERSHIP_MAX_ROWS to change this.`);
  console.log('');
  printRows(rows.slice(0, MAX_ROWS));
  console.log('');
  printHandoffCue(rows);

  if (STRICT) {
    const failures = strictFailures(rows);
    printStrictFailures(failures);
    if (failures.length > 0) process.exit(1);
  }
}

main();
