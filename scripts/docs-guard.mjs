import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const REQUIRED_DOCS = [
  'docs/agent-playbook.md',
  'docs/change-routing.md',
  'docs/decision-log.md',
  'docs/architecture.md',
  'docs/target-architecture.md',
  'docs/file-decomposition-and-ownership.md',
  'docs/code-retirement-and-bloat-control.md',
  'docs/platform-workflow.md',
  'docs/environment-auth-supabase.md',
  'docs/supabase-schema-map.md',
  'docs/staff-api-auth-contracts.md',
  'docs/automation-email-audit.md',
  'docs/testing-and-qa.md',
  'docs/projects-contacts-estimates-calculator.md',
  'docs/quotes-invoices-job-packs.md',
  'docs/parallel-work-guardrails.md',
  'docs/costing-and-geometry.md',
  'docs/local-first-sync.md',
  'docs/design-workbench-architecture.md',
  'docs/design-list.md',
  'docs/running-jobs.md',
  'docs/schedule.md',
  'docs/security-privacy-quality.md',
];

const STARTUP_DOCS = [
  'docs/agent-playbook.md',
  'docs/change-routing.md',
  'docs/decision-log.md',
];

const DOC_TEXT_ROOTS = ['README.md', 'AGENTS.md', 'docs'];

const STALE_PATTERNS = [
  { name: 'local absolute user path', re: /\/Users\//g },
  { name: 'old repo name', re: /my-site/g },
  { name: 'Create Next App placeholder', re: /create-next-app/gi },
  { name: 'deleted costing baseline placeholder', re: /costing-baseline/g },
  { name: 'stale env example reference', re: /\.env\.example/g },
];

const REDIRECT_DOC = 'docs/design-workbench-parallel-migration-rules.md';
const REDIRECT_CANONICAL = 'docs/parallel-work-guardrails.md';
const READINESS_DOC = 'docs/portal-production-readiness.md';
const CHANGE_ROUTING_DOC = 'docs/change-routing.md';
const DECISION_LOG_DOC = 'docs/decision-log.md';
const VALID_DECISION_STATUSES = new Set(['Active', 'Promoted', 'Superseded']);

const REPO_WALK_SKIP_DIRS = new Set([
  '.git',
  '.next',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

// Curated allowlist of non-ASCII code points permitted in docs prose.
// Kept narrow on purpose: invisible whitespace, BOMs, smart quotes, RTL
// overrides, etc. are deliberately NOT allowed so that copy-paste hazards
// and security-relevant glyphs still trip the gate. Add a code point here
// only when you have a real need for it in docs prose.
const ALLOWED_NON_ASCII_CODE_POINTS = new Set([
  // Typography dashes and ellipsis
  0x2013, // EN DASH
  0x2014, // EM DASH
  0x2026, // HORIZONTAL ELLIPSIS
  // Math and comparison
  0x00B1, // PLUS-MINUS SIGN
  0x00D7, // MULTIPLICATION SIGN
  0x00F7, // DIVISION SIGN
  0x2212, // MINUS SIGN
  0x2248, // ALMOST EQUAL TO
  0x2260, // NOT EQUAL TO
  0x2264, // LESS-THAN OR EQUAL TO
  0x2265, // GREATER-THAN OR EQUAL TO
  // Single arrows
  0x2190, 0x2191, 0x2192, 0x2193, 0x2194, 0x2195,
  // Double arrows
  0x21D0, 0x21D1, 0x21D2, 0x21D3, 0x21D4, 0x21D5,
  // Status / annotation glyphs (commonly used in tables and decision logs)
  0x23F3, // HOURGLASS NOT DONE
  0x26A0, // WARNING SIGN
  0x274C, // CROSS MARK
  0x2705, // WHITE HEAVY CHECK MARK
  // Status circles
  0x26AA, // MEDIUM WHITE CIRCLE
  0x26AB, // MEDIUM BLACK CIRCLE
  0x1F534, // LARGE RED CIRCLE
  0x1F535, // LARGE BLUE CIRCLE
  0x1F7E0, // LARGE ORANGE CIRCLE
  0x1F7E1, // LARGE YELLOW CIRCLE
  0x1F7E2, // LARGE GREEN CIRCLE
  0x1F7E3, // LARGE PURPLE CIRCLE
  0x1F7E4, // LARGE BROWN CIRCLE
  // Common punctuation + glyphs used in plan docs and inspector mockups
  0x00A7, // SECTION SIGN (§)
  0x00B0, // DEGREE SIGN (°)
  0x00B7, // MIDDLE DOT (·)
  0x2032, // PRIME (′)
  0x25B6, // BLACK RIGHT-POINTING TRIANGLE (▶)
  0x25BE, // BLACK DOWN-POINTING SMALL TRIANGLE (▾)
  // Box-drawing characters (ASCII-art mockups in plan docs)
  0x2500, // BOX DRAWINGS LIGHT HORIZONTAL (─)
  0x2502, // BOX DRAWINGS LIGHT VERTICAL (│)
  0x2510, // BOX DRAWINGS LIGHT DOWN AND LEFT (┐)
  0x2514, // BOX DRAWINGS LIGHT UP AND RIGHT (└)
  0x253C, // BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL (┼)
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function walkFiles(relPath) {
  const absPath = path.join(ROOT, relPath);
  const stat = fs.statSync(absPath);
  if (stat.isFile()) return [toPosix(relPath)];

  const results = [];
  for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
    const child = path.join(relPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(child));
    } else if (entry.isFile()) {
      results.push(toPosix(child));
    }
  }
  return results;
}

function walkRepoPaths(relPath = '.') {
  const absPath = path.join(ROOT, relPath);
  const results = [];
  for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
    if (REPO_WALK_SKIP_DIRS.has(entry.name)) continue;

    const child = relPath === '.' ? entry.name : path.join(relPath, entry.name);
    const normalized = toPosix(child);
    results.push(normalized);
    if (entry.isDirectory()) {
      results.push(...walkRepoPaths(child));
    }
  }
  return results;
}

function docTextFiles() {
  const files = [];
  for (const root of DOC_TEXT_ROOTS) {
    if (!exists(root)) continue;
    for (const file of walkFiles(root)) {
      if (file.endsWith('.md')) files.push(file);
    }
  }
  return files;
}

function commandTextFiles() {
  const files = [...docTextFiles()];
  if (exists('.github')) {
    for (const file of walkFiles('.github')) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) files.push(file);
    }
  }
  if (exists('scripts')) {
    for (const file of walkFiles('scripts')) {
      if (/\.(cjs|js|mjs|ts|tsx)$/.test(file)) files.push(file);
    }
  }
  return [...new Set(files)];
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

function includesPath(text, relPath) {
  return text.includes(relPath) || text.includes(relPath.replace(/^docs\//, ''));
}

function normalizeMarkdownHref(rawHref) {
  const trimmed = rawHref.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }

  const whitespace = trimmed.search(/\s/);
  return whitespace === -1 ? trimmed : trimmed.slice(0, whitespace);
}

function shouldCheckMarkdownHref(href) {
  if (!href) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false;
  return true;
}

function withoutAnchorOrQuery(href) {
  return href.split('#')[0].split('?')[0];
}

function anchorFromHref(href) {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return '';
  return href.slice(hashIndex + 1).split('?')[0];
}

function localMarkdownLinkTarget(file, href) {
  const target = withoutAnchorOrQuery(href);
  if (!target) return file;
  // Try doc-relative first (matches strict Markdown semantics).
  const docRelative = toPosix(path.normalize(path.join(path.dirname(file), target)));
  if (exists(docRelative)) return docRelative;
  // Fall back to repo-rooted resolution. Many of our plan docs write
  // links as `apps/portal/...` or `packages/geometry/...` — that's the
  // convention throughout the repo. Accept both as valid as long as one
  // resolves; the resolver returns whichever exists so the downstream
  // existence check stays accurate.
  if (target.startsWith('/') || target.startsWith('.') || target.startsWith('#')) {
    return docRelative;
  }
  const repoRooted = toPosix(path.normalize(target));
  if (exists(repoRooted)) return repoRooted;
  return docRelative;
}

function stripInlineMarkdown(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function githubHeadingSlug(value) {
  return stripInlineMarkdown(value)
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function markdownAnchors(text) {
  const anchors = new Set();
  const counts = new Map();
  const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  for (const match of text.matchAll(headingPattern)) {
    const baseSlug = githubHeadingSlug(match[2]);
    if (!baseSlug) continue;

    const count = counts.get(baseSlug) || 0;
    counts.set(baseSlug, count + 1);
    anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
  }
  return anchors;
}

function dateFromYmd(year, month, day) {
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

function packageScripts() {
  const packageJson = JSON.parse(readText('package.json'));
  return new Set(Object.keys(packageJson.scripts || {}));
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

function extractBacktickValues(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function decisionLogEntries(text) {
  const headingPattern = /^### (\d{4}-\d{2}-\d{2}) - (.+?) - (.+)$/gm;
  const headings = [...text.matchAll(headingPattern)];
  return headings.map((heading, index) => {
    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = index + 1 < headings.length ? headings[index + 1].index : text.length;
    const body = text.slice(bodyStart, bodyEnd);
    return {
      date: heading[1],
      area: heading[2],
      title: heading[3],
      line: lineAndColumnAt(text, heading.index).line,
      body,
    };
  });
}

function entryField(entry, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = entry.body.match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function globToRegExp(pattern) {
  let source = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function pathPatternMatches(pattern, repoPaths) {
  if (!pattern.includes('*')) return repoPaths.has(pattern);
  const re = globToRegExp(pattern);
  for (const repoPath of repoPaths) {
    if (re.test(repoPath)) return true;
  }
  return false;
}

function isDocPath(value) {
  return (
    value === 'AGENTS.md' ||
    value === 'README.md' ||
    value.startsWith('docs/') ||
    value.endsWith('/README.md')
  );
}

const failures = [];

function fail(message) {
  failures.push(message);
}

const docFiles = docTextFiles();
const markdownAnchorCache = new Map();

function anchorsForMarkdownFile(file) {
  if (!markdownAnchorCache.has(file)) {
    markdownAnchorCache.set(file, markdownAnchors(readText(file)));
  }
  return markdownAnchorCache.get(file);
}

for (const doc of REQUIRED_DOCS) {
  if (!exists(doc)) fail(`Missing required agent doc: ${doc}`);
}

const agents = exists('AGENTS.md') ? readText('AGENTS.md') : '';
const docsIndex = exists('docs/README.md') ? readText('docs/README.md') : '';
const playbook = exists('docs/agent-playbook.md') ? readText('docs/agent-playbook.md') : '';

for (const doc of REQUIRED_DOCS) {
  if (!includesPath(agents, doc)) fail(`AGENTS.md does not link required doc: ${doc}`);
  if (!includesPath(docsIndex, doc)) fail(`docs/README.md does not link required doc: ${doc}`);
}

for (const doc of STARTUP_DOCS) {
  if (!includesPath(agents, doc)) fail(`AGENTS.md startup path is missing ${doc}`);
  if (!includesPath(docsIndex, doc)) fail(`docs/README.md startup path is missing ${doc}`);
  if (doc !== 'docs/agent-playbook.md' && !includesPath(playbook, doc)) {
    fail(`docs/agent-playbook.md startup path is missing ${doc}`);
  }
}

const scripts = packageScripts();
for (const file of commandTextFiles()) {
  const text = readText(file);
  const commandPattern = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g;
  for (const match of text.matchAll(commandPattern)) {
    const script = match[1];
    if (!scripts.has(script)) {
      const pos = lineAndColumnAt(text, match.index);
      fail(`${file}:${pos.line}:${pos.col} documents missing package script: npm run ${script}`);
    }
  }
}

for (const file of docFiles) {
  const text = readText(file);

  const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/g;
  for (const match of text.matchAll(markdownLinkPattern)) {
    const href = normalizeMarkdownHref(match[1]);
    if (!shouldCheckMarkdownHref(href)) continue;

    const target = localMarkdownLinkTarget(file, href);
    if (target && !exists(target)) {
      const pos = lineAndColumnAt(text, match.index);
      fail(`${file}:${pos.line}:${pos.col} links to missing local target: ${href}`);
      continue;
    }

    const anchor = anchorFromHref(href);
    if (target && anchor && target.endsWith('.md')) {
      const anchors = anchorsForMarkdownFile(target);
      if (!anchors.has(decodeURIComponent(anchor))) {
        const pos = lineAndColumnAt(text, match.index);
        fail(`${file}:${pos.line}:${pos.col} links to missing Markdown anchor: ${href}`);
      }
    }
  }

  for (const pattern of STALE_PATTERNS) {
    pattern.re.lastIndex = 0;
    for (const match of text.matchAll(pattern.re)) {
      const pos = lineAndColumnAt(text, match.index);
      fail(`${file}:${pos.line}:${pos.col} contains ${pattern.name}: ${match[0]}`);
    }
  }

  for (let i = 0; i < text.length; ) {
    const code = text.codePointAt(i);
    const charSize = code > 0xFFFF ? 2 : 1;
    const isAsciiAllowed = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    if (isAsciiAllowed || ALLOWED_NON_ASCII_CODE_POINTS.has(code)) {
      i += charSize;
      continue;
    }
    const pos = lineAndColumnAt(text, i);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    fail(`${file}:${pos.line}:${pos.col} contains non-ASCII character U+${hex} (add to ALLOWED_NON_ASCII_CODE_POINTS in scripts/docs-guard.mjs if intentional)`);
    i += charSize;
  }
}

if (!exists(DECISION_LOG_DOC)) {
  fail(`Missing decision log: ${DECISION_LOG_DOC}`);
} else {
  const decisionText = readText(DECISION_LOG_DOC);
  const indexRows = markdownTableRows(decisionText, 'Index')
    .filter((row) => row.length >= 4 && row[0] !== 'Date')
    .map((row) => ({
      date: row[0],
      area: row[1],
      status: row[2],
      guardrail: row[3],
    }));
  const entries = decisionLogEntries(decisionText);
  const indexCounts = new Map();
  const entryCounts = new Map();

  for (const row of indexRows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      fail(`${DECISION_LOG_DOC} index row has invalid date: ${row.date}`);
    }
    if (!VALID_DECISION_STATUSES.has(row.status)) {
      fail(`${DECISION_LOG_DOC} index row for ${row.date} / ${row.area} has invalid status: ${row.status}`);
    }
    if (!row.guardrail) {
      fail(`${DECISION_LOG_DOC} index row for ${row.date} / ${row.area} is missing a guardrail summary`);
    }
    increment(indexCounts, `${row.date}|${row.area}|${row.status}`);
  }

  const requiredFields = [
    'Area',
    'Status',
    'Decision or mistake',
    'Why it mattered',
    'Current guardrail',
    'Promoted to',
    'Related docs/tests',
  ];
  for (const entry of entries) {
    const status = entryField(entry, 'Status');
    for (const field of requiredFields) {
      const value = entryField(entry, field);
      if (value === null || value.length === 0) {
        fail(`${DECISION_LOG_DOC}:${entry.line} entry "${entry.date} - ${entry.area} - ${entry.title}" is missing field: ${field}`);
      }
    }
    if (status && !VALID_DECISION_STATUSES.has(status)) {
      fail(`${DECISION_LOG_DOC}:${entry.line} entry "${entry.date} - ${entry.area} - ${entry.title}" has invalid status: ${status}`);
    }
    if (status) increment(entryCounts, `${entry.date}|${entry.area}|${status}`);

    const promotedTo = entryField(entry, 'Promoted to');
    if (promotedTo && promotedTo !== 'None') {
      const promotedPaths = extractBacktickValues(promotedTo).filter(isDocPath);
      if (promotedPaths.length === 0) {
        fail(`${DECISION_LOG_DOC}:${entry.line} promoted entry "${entry.date} - ${entry.area} - ${entry.title}" must list promoted doc paths or None`);
      }
      for (const promotedPath of promotedPaths) {
        if (!exists(promotedPath)) {
          fail(`${DECISION_LOG_DOC}:${entry.line} promoted entry references missing doc: ${promotedPath}`);
        }
      }
    }
  }

  for (const [key, count] of indexCounts) {
    if (entryCounts.get(key) !== count) {
      fail(`${DECISION_LOG_DOC} index count does not match entries for ${key}: index=${count}, entries=${entryCounts.get(key) || 0}`);
    }
  }
  for (const [key, count] of entryCounts) {
    if (indexCounts.get(key) !== count) {
      fail(`${DECISION_LOG_DOC} entries count does not match index for ${key}: entries=${count}, index=${indexCounts.get(key) || 0}`);
    }
  }
}

if (!exists(CHANGE_ROUTING_DOC)) {
  fail(`Missing change routing doc: ${CHANGE_ROUTING_DOC}`);
} else {
  const repoPaths = new Set(walkRepoPaths());
  const routingText = readText(CHANGE_ROUTING_DOC);
  const rows = markdownTableRows(routingText, 'Path Ownership Map', /^## Common Task Cards/m)
    .filter((row) => row.length >= 3 && row[0] !== 'Paths');
  for (const row of rows) {
    const [pathsCell, readFirstCell, notesCell] = row;
    const readFirstDocs = extractBacktickValues(readFirstCell).filter(isDocPath);
    for (const docPath of readFirstDocs) {
      if (!exists(docPath)) {
        fail(`${CHANGE_ROUTING_DOC} path ownership row references missing owner doc: ${docPath}`);
      }
    }

    const allowsUnmatchedPattern = /\b(legacy|future)\b/i.test(notesCell);
    for (const pattern of extractBacktickValues(pathsCell)) {
      if (!pathPatternMatches(pattern, repoPaths) && !allowsUnmatchedPattern) {
        fail(`${CHANGE_ROUTING_DOC} path ownership pattern matches no repo paths: ${pattern}`);
      }
    }
  }
}

if (!exists(READINESS_DOC)) {
  fail(`Missing readiness tracker: ${READINESS_DOC}`);
} else {
  const readinessText = readText(READINESS_DOC);
  const match = readinessText.match(/^Last updated: (\d{4})-(\d{2})-(\d{2})\.?$/m);
  if (!match) {
    fail(`${READINESS_DOC} must contain a Last updated line in YYYY-MM-DD format`);
  } else {
    const [, year, month, day] = match;
    const trackerDate = dateFromYmd(year, month, day);
    if (!trackerDate) {
      fail(`${READINESS_DOC} has an invalid Last updated date: ${year}-${month}-${day}`);
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (trackerDate > today) {
        fail(`${READINESS_DOC} has a future Last updated date: ${year}-${month}-${day}`);
      }
    }
  }
}

if (!exists(REDIRECT_DOC)) {
  fail(`Missing superseded redirect doc: ${REDIRECT_DOC}`);
} else {
  const redirectText = readText(REDIRECT_DOC);
  const redirectLines = redirectText.split(/\r?\n/).length;
  if (!redirectText.includes(`Status: Superseded by \`${REDIRECT_CANONICAL}\`.`)) {
    fail(`${REDIRECT_DOC} does not declare ${REDIRECT_CANONICAL} as the superseding doc`);
  }
  if (!redirectText.includes('Design Workbench Overlay')) {
    fail(`${REDIRECT_DOC} does not point agents to the Design Workbench Overlay`);
  }
  if (!redirectText.includes('Do not treat this file as a second active rule set')) {
    fail(`${REDIRECT_DOC} does not warn against duplicate active rule sets`);
  }
  if (redirectLines > 40) {
    fail(`${REDIRECT_DOC} is too long for a redirect (${redirectLines} lines); keep the full rule set only in ${REDIRECT_CANONICAL}`);
  }
  for (const staleHeading of ['## Agent Quick Gate', '## Workbench Lanes', '## Workbench Merge Gates']) {
    if (redirectText.includes(staleHeading)) {
      fail(`${REDIRECT_DOC} appears to duplicate active guardrail content: ${staleHeading}`);
    }
  }
}

if (failures.length > 0) {
  console.error('docs-guard: failed\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('docs-guard: clean');
