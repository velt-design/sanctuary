import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const REQUIRED_DOCS = [
  'docs/agent-playbook.md',
  'docs/change-routing.md',
  'docs/decision-log.md',
  'docs/architecture.md',
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

const failures = [];

function fail(message) {
  failures.push(message);
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

for (const file of docTextFiles()) {
  const text = readText(file);

  for (const pattern of STALE_PATTERNS) {
    pattern.re.lastIndex = 0;
    for (const match of text.matchAll(pattern.re)) {
      const pos = lineAndColumnAt(text, match.index);
      fail(`${file}:${pos.line}:${pos.col} contains ${pattern.name}: ${match[0]}`);
    }
  }

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) continue;
    const pos = lineAndColumnAt(text, i);
    fail(`${file}:${pos.line}:${pos.col} contains non-ASCII character U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
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
