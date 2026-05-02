import fs from 'node:fs';
import path from 'node:path';

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

const THRESHOLDS = {
  'component/page': { warning: 800, critical: 1200 },
  'route/domain/package': { warning: 700, critical: 1200 },
  test: { warning: 1200, critical: 2500 },
  code: { warning: 700, critical: 1200 },
};

const HOTSPOTS = [
  { pattern: /CalculatorGridClient|ModuleViewsCard/, label: 'calculator' },
  { pattern: /drawings|ModelSpaceViewport|Geometry3DViewport|design-workbench/i, label: 'design workbench' },
  { pattern: /^packages\/geometry\//, label: 'geometry package' },
  { pattern: /staff\/schedule|ScheduleClient/, label: 'schedule' },
  { pattern: /ProjectPage\/tabs\/(QuotesTab|EstimatesTab)/, label: 'project quote/estimate tabs' },
  { pattern: /^apps\/marketing\/app\/start\//, label: 'marketing start' },
];

function toPosix(value) {
  return value.split(path.sep).join('/');
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

function lineCount(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
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

function hotspotFor(file) {
  return HOTSPOTS.find((hotspot) => hotspot.pattern.test(file))?.label ?? '';
}

function suggestedAction(row) {
  if (row.band === 'critical') return 'name owner and decomposition plan before major feature work';
  if (row.band === 'warning') return 'prefer extracting a cohesive owner before adding responsibility';
  return 'monitor';
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
    category: Math.max('Category'.length, ...rows.map((row) => row.category.length)),
    hotspot: Math.max('Hotspot'.length, ...rows.map((row) => row.hotspot.length)),
  };

  console.log(
    `${pad('Band', widths.band)}  ${pad('Lines', widths.lines)}  ${pad('Category', widths.category)}  ${pad(
      'Hotspot',
      widths.hotspot,
    )}  File`,
  );
  console.log(
    `${'-'.repeat(widths.band)}  ${'-'.repeat(widths.lines)}  ${'-'.repeat(widths.category)}  ${'-'.repeat(
      widths.hotspot,
    )}  ${'-'.repeat(40)}`,
  );

  for (const row of rows) {
    console.log(
      `${pad(row.band, widths.band)}  ${pad(row.lines, widths.lines)}  ${pad(row.category, widths.category)}  ${pad(
        row.hotspot || '-',
        widths.hotspot,
      )}  ${row.file}`,
    );
    console.log(`${' '.repeat(widths.band + widths.lines + widths.category + widths.hotspot + 8)}${row.action}`);
  }
}

function main() {
  const files = walkFiles('.');
  const rows = files
    .map((file) => {
      const normalized = file.replace(/^\.\//, '');
      const category = categoryFor(normalized);
      const lines = lineCount(normalized);
      const band = bandFor(lines, THRESHOLDS[category]);
      return {
        file: normalized,
        category,
        lines,
        band,
        hotspot: hotspotFor(normalized),
      };
    })
    .filter((row) => row.band !== 'ok')
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file))
    .map((row) => ({ ...row, action: suggestedAction(row) }));

  console.log('file-decomposition-report: advisory report');
  console.log(`Scanned ${files.length} code files. Generated, vendor, public, and build outputs are skipped.`);
  console.log('Thresholds: component/page 800/1200, route/domain/package 700/1200, test 1200/2500 lines.');
  console.log('');

  if (rows.length === 0) {
    console.log('No warning or critical files found.');
    return;
  }

  const criticalCount = rows.filter((row) => row.band === 'critical').length;
  const warningCount = rows.filter((row) => row.band === 'warning').length;
  console.log(`${criticalCount} critical file(s), ${warningCount} warning file(s).`);
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set FILES_REPORT_MAX_ROWS to change this.`);
  console.log('');
  printTable(rows.slice(0, MAX_ROWS));
  console.log('');
  console.log('This report is advisory only. Use docs/file-decomposition-and-ownership.md before expanding these files.');
}

main();
