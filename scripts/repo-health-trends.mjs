import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parseRootCompatibilityReport } from './repo-health-parsers.mjs';

const ROOT = process.cwd();
const DASHBOARD_PATH = path.join(ROOT, 'docs', 'repo-health-trends.md');
const UPDATE = process.argv.includes('--update');
const HEADLINE_METRICS = [
  ['Dead-code delete candidates', 'deadCodeDeleteCandidates', 'dead-code cleanup'],
  ['Critical files', 'criticalFiles', 'large-file decomposition'],
  ['Root compatibility files', 'rootCompatFiles', 'root compatibility retirement'],
  ['Browser-direct Supabase files', 'browserDirectSupabase', 'browser data-access migration'],
];

function runNpmScript(scriptName) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result =
    process.platform === 'win32'
      ? spawnSync(['npm', 'run', '--silent', scriptName].join(' '), {
          cwd: ROOT,
          encoding: 'utf8',
          shell: true,
        })
      : spawnSync(npmCommand, ['run', '--silent', scriptName], {
          cwd: ROOT,
          encoding: 'utf8',
        });

  if (result.error) {
    throw new Error(`repo-health-trends: failed to run ${scriptName}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`repo-health-trends: ${scriptName} failed${details ? `\n${details}` : ''}`);
  }

  return result.stdout;
}

function parseRequired(output, regex, label) {
  const match = output.match(regex);
  if (!match) {
    throw new Error(`repo-health-trends: could not parse ${label} report summary`);
  }
  return match.slice(1).map((value) => Number.parseInt(value, 10));
}

function parseFilesReport(output) {
  const match = output.match(/(\d+) critical file\(s\),\s+(\d+) warning file\(s\)\./);
  if (match) {
    return {
      criticalFiles: Number.parseInt(match[1], 10),
      warningFiles: Number.parseInt(match[2], 10),
    };
  }
  if (/No warning or critical/i.test(output)) {
    return { criticalFiles: 0, warningFiles: 0 };
  }
  throw new Error('repo-health-trends: could not parse file decomposition report summary');
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function collectSnapshot() {
  const deadCode = runNpmScript('dead-code:report');
  const files = runNpmScript('files:report');
  const rootCompat = runNpmScript('root:compat');
  const browserSupabase = runNpmScript('browser:supabase');

  const [
    deadCodeDeleteCandidates,
    deadCodeLegacyRetirement,
    deadCodeIntentionalEntrypoints,
    deadCodeNeedsProof,
  ] = parseRequired(
    deadCode,
    /(\d+) delete-candidate,\s+(\d+) legacy-retirement,\s+(\d+) intentional-entrypoint,\s+(\d+) needs-proof/,
    'dead-code',
  );

  const { criticalFiles, warningFiles } = parseFilesReport(files);

  const { legacyCompatibleFiles: rootCompatFiles } = parseRootCompatibilityReport(rootCompat);

  const [, , browserDirectSupabase, browserApprovedAdapters] = parseRequired(
    browserSupabase,
    /(\d+) new-growth,\s+(\d+) changed,\s+(\d+) legacy-direct,\s+(\d+) approved-adapter/,
    'browser Supabase',
  );

  return {
    date: process.env.REPO_HEALTH_DATE || localDateString(new Date()),
    deadCodeDeleteCandidates,
    deadCodeLegacyRetirement,
    deadCodeIntentionalEntrypoints,
    deadCodeNeedsProof,
    criticalFiles,
    warningFiles,
    rootCompatFiles,
    browserDirectSupabase,
    browserApprovedAdapters,
  };
}

function metricRows(snapshot) {
  return [
    ['Dead-code delete candidates', snapshot.deadCodeDeleteCandidates],
    ['Dead-code legacy retirement', snapshot.deadCodeLegacyRetirement],
    ['Dead-code needs proof', snapshot.deadCodeNeedsProof],
    ['Critical files', snapshot.criticalFiles],
    ['Warning files', snapshot.warningFiles],
    ['Root compatibility files', snapshot.rootCompatFiles],
    ['Browser-direct Supabase files', snapshot.browserDirectSupabase],
    ['Browser Supabase approved adapters', snapshot.browserApprovedAdapters],
  ];
}

function parseTrendRows() {
  if (!fs.existsSync(DASHBOARD_PATH)) return [];

  const text = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith('| Date | Dead-code delete candidates |'));
  if (headerIndex === -1) return [];

  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('|')) break;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 7) continue;

    rows.push({
      date: cells[0],
      deadCodeDeleteCandidates: Number.parseInt(cells[1], 10),
      deadCodeLegacyRetirement: Number.parseInt(cells[2], 10),
      criticalFiles: Number.parseInt(cells[3], 10),
      warningFiles: Number.parseInt(cells[4], 10),
      rootCompatFiles: Number.parseInt(cells[5], 10),
      browserDirectSupabase: Number.parseInt(cells[6], 10),
    });
  }

  return rows.filter((row) => row.date && !Number.isNaN(row.deadCodeDeleteCandidates));
}

function previousSnapshotFor(snapshot) {
  return parseTrendRows()
    .filter((row) => row.date < snapshot.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1) ?? null;
}

function baselineSnapshotFor(snapshot) {
  return parseTrendRows()
    .filter((row) => row.date <= snapshot.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(0) ?? null;
}

function deltaValue(currentValue, previousValue) {
  if (typeof previousValue !== 'number' || Number.isNaN(previousValue)) return null;
  return currentValue - previousValue;
}

function formatDelta(currentValue, previousValue) {
  const delta = deltaValue(currentValue, previousValue);
  if (delta === null) return 'n/a';
  if (delta === 0) return '0';
  return delta > 0 ? `+${delta}` : String(delta);
}

function directionFor(currentValue, baselineValue) {
  const delta = deltaValue(currentValue, baselineValue);
  if (delta === null) return 'new';
  if (delta < 0) return 'better';
  if (delta > 0) return 'worse';
  return 'flat';
}

function recommendedLane(snapshot, previousSnapshot, baselineSnapshot) {
  const candidates = HEADLINE_METRICS.map(([label, key, lane]) => {
    const previousDelta = deltaValue(snapshot[key], previousSnapshot?.[key]);
    const baselineDelta = deltaValue(snapshot[key], baselineSnapshot?.[key]);
    const score = Math.max(previousDelta ?? 0, baselineDelta ?? 0);
    return { label, lane, score, previousDelta, baselineDelta };
  }).filter((candidate) => candidate.score > 0);

  if (candidates.length === 0) {
    return 'Recommended next lane: no headline metric is worse than the available comparison snapshots; choose the current highest-priority cleanup lane manually.';
  }

  const worst = candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))[0];
  const reason =
    worst.baselineDelta && worst.baselineDelta > 0
      ? `${worst.label} is up ${worst.baselineDelta} from baseline`
      : `${worst.label} is up ${worst.previousDelta} from the previous snapshot`;
  return `Recommended next lane: ${worst.lane}, because ${reason}.`;
}

function printHeadline(snapshot, previousSnapshot, baselineSnapshot) {
  const rows = HEADLINE_METRICS.map(([label, key]) => ({
    label,
    current: String(snapshot[key]),
    previousDelta: formatDelta(snapshot[key], previousSnapshot?.[key]),
    baselineDelta: formatDelta(snapshot[key], baselineSnapshot?.[key]),
    direction: directionFor(snapshot[key], baselineSnapshot?.[key]),
  }));
  const widths = {
    label: Math.max('Metric'.length, ...rows.map((row) => row.label.length)),
    current: Math.max('Current'.length, ...rows.map((row) => row.current.length)),
    previous: Math.max('Vs previous'.length, ...rows.map((row) => row.previousDelta.length)),
    baseline: Math.max('Vs baseline'.length, ...rows.map((row) => row.baselineDelta.length)),
    direction: Math.max('Direction'.length, ...rows.map((row) => row.direction.length)),
  };

  console.log('Headline');
  console.log(
    `${'Metric'.padEnd(widths.label)}  ${'Current'.padStart(widths.current)}  ${'Vs previous'.padStart(widths.previous)}  ${'Vs baseline'.padStart(widths.baseline)}  ${'Direction'.padStart(widths.direction)}`,
  );
  console.log(
    `${'-'.repeat(widths.label)}  ${'-'.repeat(widths.current)}  ${'-'.repeat(widths.previous)}  ${'-'.repeat(widths.baseline)}  ${'-'.repeat(widths.direction)}`,
  );
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(widths.label)}  ${row.current.padStart(widths.current)}  ${row.previousDelta.padStart(widths.previous)}  ${row.baselineDelta.padStart(widths.baseline)}  ${row.direction.padStart(widths.direction)}`,
    );
  }
  console.log('');
  console.log(recommendedLane(snapshot, previousSnapshot, baselineSnapshot));
  console.log('');
}

function printSnapshot(snapshot) {
  const previousSnapshot = previousSnapshotFor(snapshot);
  const baselineSnapshot = baselineSnapshotFor(snapshot);
  const rows = metricRows(snapshot);
  const metricWidth = Math.max('Metric'.length, ...rows.map(([metric]) => metric.length));
  const valueWidth = Math.max('Value'.length, ...rows.map(([, value]) => String(value).length));

  console.log('repo-health-trends: current advisory snapshot');
  console.log(`Date: ${snapshot.date}`);
  if (previousSnapshot) console.log(`Compared with: ${previousSnapshot.date}`);
  if (baselineSnapshot) console.log(`Baseline: ${baselineSnapshot.date}`);
  console.log('');
  printHeadline(snapshot, previousSnapshot, baselineSnapshot);
  console.log(`${'Metric'.padEnd(metricWidth)}  ${'Value'.padStart(valueWidth)}`);
  console.log(`${'-'.repeat(metricWidth)}  ${'-'.repeat(valueWidth)}`);
  for (const [metric, value] of rows) {
    console.log(`${metric.padEnd(metricWidth)}  ${String(value).padStart(valueWidth)}`);
  }
  console.log('');
  console.log('Run `npm run repo:health:update` to record this snapshot in docs/repo-health-trends.md.');
}

function trendRow(snapshot) {
  return `| ${snapshot.date} | ${snapshot.deadCodeDeleteCandidates} | ${snapshot.deadCodeLegacyRetirement} | ${snapshot.criticalFiles} | ${snapshot.warningFiles} | ${snapshot.rootCompatFiles} | ${snapshot.browserDirectSupabase} |`;
}

function initialDashboard(snapshot) {
  return `# Repo Health Trends

Status: Advisory dashboard.

Audience: agents and maintainers.

Purpose: track whether cleanup pressure is trending better or worse over time. These numbers are visibility signals, not enforcement thresholds.

## Metrics

- Dead-code delete candidates: delete-candidate count from \`npm run dead-code:report\`.
- Dead-code legacy retirement: legacy-retirement count from \`npm run dead-code:report\`.
- Critical files: critical count from \`npm run files:report\`.
- Warning files: warning count from \`npm run files:report\`.
- Root compat files: legacy-compatible count from \`npm run root:compat\`.
- Browser-direct Supabase: legacy-direct count from \`npm run browser:supabase\`.

## Trend

| Date | Dead-code delete candidates | Dead-code legacy retirement | Critical files | Warning files | Root compat files | Browser-direct Supabase |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${trendRow(snapshot)}

## Usage

- Run \`npm run repo:health\` to print the current advisory snapshot.
- Run \`npm run repo:health:update\` to record or replace today's row.
- Use the slope to choose cleanup lanes; do not treat a single number as proof that code is safe to delete.
`;
}

function updateDashboard(snapshot) {
  if (!fs.existsSync(DASHBOARD_PATH)) {
    fs.writeFileSync(DASHBOARD_PATH, initialDashboard(snapshot), 'utf8');
    console.log(`repo-health-trends: created docs/repo-health-trends.md for ${snapshot.date}`);
    return;
  }

  const text = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith('| Date | Dead-code delete candidates |'));

  if (headerIndex === -1) {
    const nextText = `${text.replace(/\s*$/, '')}\n\n## Trend\n\n| Date | Dead-code delete candidates | Dead-code legacy retirement | Critical files | Warning files | Root compat files | Browser-direct Supabase |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${trendRow(snapshot)}\n`;
    fs.writeFileSync(DASHBOARD_PATH, nextText, 'utf8');
    console.log(`repo-health-trends: added trend table for ${snapshot.date}`);
    return;
  }

  let tableEnd = headerIndex + 2;
  while (tableEnd < lines.length && lines[tableEnd].startsWith('|')) {
    tableEnd += 1;
  }

  const row = trendRow(snapshot);
  const existingIndex = lines.findIndex((line, index) => index > headerIndex + 1 && line.startsWith(`| ${snapshot.date} |`));
  if (existingIndex !== -1 && existingIndex < tableEnd) {
    lines[existingIndex] = row;
    fs.writeFileSync(DASHBOARD_PATH, lines.join('\n'), 'utf8');
    console.log(`repo-health-trends: updated docs/repo-health-trends.md for ${snapshot.date}`);
    return;
  }

  lines.splice(tableEnd, 0, row);
  fs.writeFileSync(DASHBOARD_PATH, lines.join('\n'), 'utf8');
  console.log(`repo-health-trends: appended docs/repo-health-trends.md for ${snapshot.date}`);
}

function main() {
  const snapshot = collectSnapshot();
  printSnapshot(snapshot);
  if (UPDATE) updateDashboard(snapshot);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
