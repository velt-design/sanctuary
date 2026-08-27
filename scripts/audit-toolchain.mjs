import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_XLSX_ADVISORIES = new Set([
  'GHSA-4r6h-8v6p-xvw6',
  'GHSA-5pgg-2g8v-p4x9',
]);

export const ALLOWED_XLSX_IMPORT = 'scripts/import-running-jobs-legacy.ts';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const EXECUTABLE_SOURCE = /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'public',
  'tmp',
  'vendor',
]);
const XLSX_IMPORT_PATTERNS = [
  /\bimport\s*['"]xlsx['"]/,
  /\b(?:import|export)\s+(?:type\s+)?[^;'"]{1,400}\sfrom\s*['"]xlsx['"]/,
  /\bimport\s*\(\s*['"]xlsx['"]\s*\)/,
  /\brequire\s*\(\s*['"]xlsx['"]\s*\)/,
];

function readJson(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function workspaceManifestPaths(rootDirectory, rootManifest) {
  const results = [];
  const workspacePatterns = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : rootManifest.workspaces?.packages;

  if (!Array.isArray(workspacePatterns)) return results;

  for (const pattern of workspacePatterns) {
    if (typeof pattern !== 'string' || !pattern.endsWith('/*')) continue;
    const workspaceRoot = path.join(rootDirectory, pattern.slice(0, -2));
    if (!existsSync(workspaceRoot)) continue;

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(workspaceRoot, entry.name, 'package.json');
      if (existsSync(manifestPath)) results.push(manifestPath);
    }
  }

  return results.sort();
}

export function validateXlsxDependencyPolicy(rootDirectory = process.cwd()) {
  const errors = [];
  const rootManifestPath = path.join(rootDirectory, 'package.json');
  const lockfilePath = path.join(rootDirectory, 'package-lock.json');
  const rootManifest = readJson(rootManifestPath);
  const lockfile = readJson(lockfilePath);
  const declaredVersion = rootManifest.devDependencies?.xlsx;

  if (typeof declaredVersion !== 'string' || declaredVersion.length === 0) {
    errors.push('xlsx must remain a direct root devDependency.');
  }

  for (const field of DEPENDENCY_FIELDS) {
    if (field !== 'devDependencies' && rootManifest[field]?.xlsx !== undefined) {
      errors.push(`xlsx must not be declared in root ${field}.`);
    }
  }

  for (const manifestPath of workspaceManifestPaths(rootDirectory, rootManifest)) {
    const manifest = readJson(manifestPath);
    for (const field of DEPENDENCY_FIELDS) {
      if (manifest[field]?.xlsx !== undefined) {
        errors.push(
          `xlsx must stay root-only; found it in ${toPosix(path.relative(rootDirectory, manifestPath))} ${field}.`,
        );
      }
    }
  }

  const lockRoot = lockfile.packages?.[''];
  if (!lockRoot || lockRoot.devDependencies?.xlsx !== declaredVersion) {
    errors.push('package-lock.json must record xlsx as the same root devDependency.');
  }

  for (const field of DEPENDENCY_FIELDS) {
    if (field !== 'devDependencies' && lockRoot?.[field]?.xlsx !== undefined) {
      errors.push(`package-lock.json must not record xlsx in root ${field}.`);
    }
  }

  const lockedXlsx = lockfile.packages?.['node_modules/xlsx'];
  if (!lockedXlsx || lockedXlsx.dev !== true) {
    errors.push('The locked xlsx package must be marked development-only.');
  }

  return errors;
}

function walkExecutableSources(rootDirectory, relativeDirectory = '') {
  const absoluteDirectory = path.join(rootDirectory, relativeDirectory);
  const results = [];

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkExecutableSources(rootDirectory, relativePath));
    } else if (entry.isFile() && EXECUTABLE_SOURCE.test(entry.name)) {
      results.push(relativePath);
    }
  }

  return results;
}

export function findExecutableXlsxImports(rootDirectory = process.cwd()) {
  return walkExecutableSources(rootDirectory)
    .filter((relativePath) => {
      const source = readFileSync(path.join(rootDirectory, relativePath), 'utf8');
      return XLSX_IMPORT_PATTERNS.some((pattern) => pattern.test(source));
    })
    .map(toPosix)
    .sort();
}

export function validateXlsxImportPolicy(rootDirectory = process.cwd()) {
  const imports = findExecutableXlsxImports(rootDirectory);
  return imports.length === 1 && imports[0] === ALLOWED_XLSX_IMPORT
    ? []
    : [
        `xlsx executable imports must be exactly ${ALLOWED_XLSX_IMPORT}; found ${imports.length === 0 ? 'none' : imports.join(', ')}.`,
      ];
}

function advisoryIds(vulnerability) {
  const ids = new Set();
  let unidentified = false;

  for (const cause of Array.isArray(vulnerability.via) ? vulnerability.via : []) {
    if (typeof cause === 'string') {
      unidentified = true;
      continue;
    }

    const match = typeof cause?.url === 'string' && cause.url.match(/GHSA-[a-z0-9-]+/i);
    if (!match) {
      unidentified = true;
      continue;
    }
    ids.add(`GHSA-${match[0].slice(5).toLowerCase()}`);
  }

  return { ids, unidentified };
}

export function evaluateAuditReport(report) {
  const errors = [];

  if (!report || typeof report !== 'object') return ['npm audit returned no JSON object.'];
  if (!report.metadata?.vulnerabilities || typeof report.metadata.vulnerabilities !== 'object') {
    errors.push('npm audit JSON is missing vulnerability metadata.');
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    errors.push('npm audit JSON is missing the vulnerabilities map.');
    return errors;
  }

  const vulnerabilitySummary = report.metadata.vulnerabilities;
  const severityCounts = ['info', 'low', 'moderate', 'high', 'critical'].map(
    (severity) => vulnerabilitySummary[severity],
  );
  const vulnerabilityNames = Object.keys(report.vulnerabilities);
  if (
    severityCounts.some((count) => !Number.isInteger(count) || count < 0) ||
    !Number.isInteger(vulnerabilitySummary.total) ||
    vulnerabilitySummary.total < 0
  ) {
    errors.push('npm audit JSON contains invalid vulnerability counts.');
  } else if (
    severityCounts.reduce((total, count) => total + count, 0) !==
      vulnerabilitySummary.total ||
    vulnerabilitySummary.total !== vulnerabilityNames.length
  ) {
    errors.push('npm audit vulnerability metadata does not match its package map.');
  }

  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (packageName !== 'xlsx') {
      errors.push(
        `Unexpected ${vulnerability?.severity ?? 'unknown-severity'} vulnerability in ${packageName}.`,
      );
      continue;
    }

    if (vulnerability?.isDirect !== true) {
      errors.push('The xlsx exception applies only while xlsx is a direct dependency.');
    }
    if (vulnerability?.fixAvailable !== false) {
      errors.push('A fix is available for xlsx; remove the exception and upgrade it.');
    }
    if (
      !Array.isArray(vulnerability?.nodes) ||
      vulnerability.nodes.length !== 1 ||
      vulnerability.nodes[0] !== 'node_modules/xlsx'
    ) {
      errors.push('The xlsx exception applies only to the single root node_modules/xlsx package.');
    }

    const { ids, unidentified } = advisoryIds(vulnerability ?? {});
    if (ids.size === 0 || unidentified) {
      errors.push('The xlsx vulnerability contains an unidentified advisory path.');
    }
    for (const id of ids) {
      if (!ALLOWED_XLSX_ADVISORIES.has(id)) {
        errors.push(`Unexpected xlsx advisory ${id}.`);
      }
    }
  }

  return errors;
}

export function runToolchainAudit(rootDirectory = process.cwd()) {
  const errors = [
    ...validateXlsxDependencyPolicy(rootDirectory),
    ...validateXlsxImportPolicy(rootDirectory),
  ];
  const npmCli = process.env.npm_execpath;
  const npmCommand = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmArgs = npmCli ? [npmCli, 'audit', '--json'] : ['audit', '--json'];
  const result = spawnSync(npmCommand, npmArgs, {
    cwd: rootDirectory,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    shell: !npmCli && process.platform === 'win32',
  });

  if (result.error) {
    errors.push(`npm audit could not run: ${result.error.message}`);
  } else if (result.status !== 0 && result.status !== 1) {
    errors.push(`npm audit exited unexpectedly with status ${result.status ?? 'unknown'}.`);
  }

  let report;
  try {
    report = JSON.parse(result.stdout || '');
  } catch {
    errors.push('npm audit did not return valid JSON.');
  }
  if (report) errors.push(...evaluateAuditReport(report));

  if (errors.length > 0) {
    throw new Error(`Toolchain audit failed:\n- ${errors.join('\n- ')}`);
  }

  const allowedCount = Object.keys(report.vulnerabilities).includes('xlsx')
    ? advisoryIds(report.vulnerabilities.xlsx).ids.size
    : 0;
  return `Toolchain audit passed; ${allowedCount} approved xlsx advisory exception(s), no other vulnerabilities.`;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    console.log(runToolchainAudit());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
