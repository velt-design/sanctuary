import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const READINESS_DOC = 'docs/portal-production-readiness.md';
const RECOGNIZED_STATUSES = ['Green', 'Yellow', 'Red', 'Unknown'];
const AT_RISK_STATUSES = new Set(['Yellow', 'Red', 'Unknown']);

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function dateFromYmd(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return parsed;
}

function markdownTableRows(text, heading, nextHeadingPattern = /^## /m) {
  const headingIndex = text.indexOf(`## ${heading}`);
  if (headingIndex === -1) return [];

  const afterHeading = text.slice(headingIndex + heading.length + 3);
  const nextHeading = afterHeading.search(nextHeadingPattern);
  const section = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|\s*-+/.test(line))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
}

function currentReadinessRows(text) {
  return markdownTableRows(text, 'Current Readiness Snapshot', /^## Production-Grade Checklist/m)
    .filter((row) => row.length >= 4 && row[0] !== 'Area')
    .map(([area, status, lastKnownSignal, nextAction]) => ({
      area,
      status,
      lastKnownSignal,
      nextAction,
    }));
}

function checklistCounts(text) {
  const lines = text.split(/\r?\n/);
  const counts = new Map();
  let inChecklist = false;
  let currentSection = null;

  for (const line of lines) {
    if (line === '## Production-Grade Checklist') {
      inChecklist = true;
      continue;
    }
    if (inChecklist && line.startsWith('## ') && line !== '## Production-Grade Checklist') {
      break;
    }
    if (!inChecklist) continue;

    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      currentSection = heading[1];
      if (!counts.has(currentSection)) counts.set(currentSection, { checked: 0, unchecked: 0 });
      continue;
    }

    const item = line.match(/^-\s+\[([ xX])\]\s+/);
    if (item && currentSection) {
      const bucket = counts.get(currentSection);
      if (item[1].toLowerCase() === 'x') {
        bucket.checked += 1;
      } else {
        bucket.unchecked += 1;
      }
    }
  }

  return counts;
}

function daysSince(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today.getTime() - midnight.getTime()) / 86_400_000);
}

function main() {
  const text = readText(READINESS_DOC);
  const lastUpdatedMatch = text.match(/^Last updated: (\d{4}-\d{2}-\d{2})\.?$/m);
  const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : null;
  const parsedDate = lastUpdated ? dateFromYmd(lastUpdated) : null;
  const rows = currentReadinessRows(text);
  const counts = Object.fromEntries(RECOGNIZED_STATUSES.map((status) => [status, 0]));
  const unknownStatuses = new Set();

  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] += 1;
    } else {
      unknownStatuses.add(row.status);
    }
  }

  const atRiskRows = rows.filter((row) => AT_RISK_STATUSES.has(row.status) || !RECOGNIZED_STATUSES.includes(row.status));
  const checklist = checklistCounts(text);

  console.log('readiness-report: advisory report');
  if (lastUpdated && parsedDate) {
    console.log(`Tracker: ${READINESS_DOC}`);
    console.log(`Last updated: ${lastUpdated} (${daysSince(parsedDate)} day(s) old)`);
  } else {
    console.log(`Tracker: ${READINESS_DOC}`);
    console.log('Last updated: missing or invalid');
  }

  console.log('');
  console.log('Snapshot status counts:');
  for (const status of RECOGNIZED_STATUSES) {
    console.log(`- ${status}: ${counts[status]}`);
  }
  for (const status of unknownStatuses) {
    console.log(`- Unrecognized (${status}): ${rows.filter((row) => row.status === status).length}`);
  }

  console.log('');
  console.log('At-risk snapshot rows:');
  if (atRiskRows.length === 0) {
    console.log('- none');
  } else {
    for (const row of atRiskRows) {
      console.log(`- ${row.area} [${row.status}]`);
      console.log(`  Last known signal: ${row.lastKnownSignal}`);
      console.log(`  Next action: ${row.nextAction}`);
    }
  }

  console.log('');
  console.log('Unchecked checklist counts:');
  if (checklist.size === 0) {
    console.log('- none found');
  } else {
    for (const [section, count] of checklist.entries()) {
      console.log(`- ${section}: ${count.unchecked} unchecked, ${count.checked} checked`);
    }
  }

  console.log('');
  console.log('This report is advisory only; re-run the listed commands or manual checks before treating readiness rows as current.');
}

main();
