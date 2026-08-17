import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public', 'vendor']);
const CODE_FILE_RE = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function isDirectory(absPath) {
  try {
    return fs.statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}

function workspaceDirs(rootRelPath) {
  const absRoot = path.join(ROOT, rootRelPath);
  if (!isDirectory(absRoot)) return [];

  return fs
    .readdirSync(absRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => toPosix(path.join(rootRelPath, entry.name)))
    .filter((relPath) => exists(`${relPath}/package.json`))
    .sort();
}

function localPackageName(specifier) {
  if (!specifier.startsWith('@')) return '';
  const parts = specifier.split('/');
  if (parts.length < 2) return '';
  return `${parts[0]}/${parts[1]}`;
}

function collectLocalPackages() {
  const packages = new Map();
  for (const packageDir of workspaceDirs('packages')) {
    const pkg = readJson(`${packageDir}/package.json`);
    if (typeof pkg.name === 'string' && pkg.name.trim()) {
      packages.set(pkg.name.trim(), packageDir);
    }
  }
  return packages;
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

function importedLocalPackages(appDir, localPackages) {
  const imports = new Map();
  for (const file of walkFiles(appDir)) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const packageName = localPackageName(match[1]);
        if (!localPackages.has(packageName)) continue;
        if (!imports.has(packageName)) imports.set(packageName, new Set());
        imports.get(packageName).add(file);
      }
    }
  }
  return imports;
}

function dependencySections(pkg) {
  return [
    pkg.dependencies ?? {},
    pkg.devDependencies ?? {},
    pkg.peerDependencies ?? {},
    pkg.optionalDependencies ?? {},
  ];
}

function hasDeclaredDependency(pkg, packageName) {
  return dependencySections(pkg).some((section) => Object.prototype.hasOwnProperty.call(section, packageName));
}

function nextConfigPath(appDir) {
  for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.js']) {
    const relPath = `${appDir}/${name}`;
    if (exists(relPath)) return relPath;
  }
  return '';
}

function transpilePackages(configRelPath) {
  if (!configRelPath) return null;
  const text = fs.readFileSync(path.join(ROOT, configRelPath), 'utf8');
  const match = text.match(/\btranspilePackages\s*:\s*\[([\s\S]*?)\]/m);
  if (!match) return new Set();
  return new Set([...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]));
}

const localPackages = collectLocalPackages();
const failures = [];

for (const [packageName, packageDir] of localPackages) {
  const packageFiles = walkFiles(packageDir);
  for (const file of packageFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        const directAppImport = specifier.startsWith('@/') || /^apps(?:\/|$)/.test(specifier);
        const resolvedImport = specifier.startsWith('.')
          ? path.resolve(path.dirname(path.join(ROOT, file)), specifier)
          : '';
        const relativeToApps = resolvedImport ? path.relative(path.join(ROOT, 'apps'), resolvedImport) : '..';
        const relativeAppImport = relativeToApps !== '..'
          && !relativeToApps.startsWith(`..${path.sep}`)
          && !path.isAbsolute(relativeToApps);
        if (directAppImport || relativeAppImport) {
          failures.push(`${packageName} must not import app-owned code. Found ${specifier} in ${file}.`);
        }
      }
    }
  }
}

const configuratorCoreDir = 'packages/configurator/src/core';
if (isDirectory(path.join(ROOT, configuratorCoreDir))) {
  const forbiddenCoreImports = ['react', 'next', '@supabase/supabase-js', '@sp/geometry', '@sp/costing'];
  for (const file of walkFiles(configuratorCoreDir).filter((item) => !item.endsWith('.test.ts'))) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        if (forbiddenCoreImports.some((specifier) => (
          match[1] === specifier || match[1].startsWith(`${specifier}/`)
        ))) {
          failures.push(`${file} imports ${match[1]}; @sp/configurator/core must remain lightweight and universal.`);
        }
      }
    }
    if (/\b(?:window|document|localStorage|sessionStorage)\b/.test(source)) {
      failures.push(`${file} uses a browser global; @sp/configurator/core must remain universal.`);
    }
  }
}

for (const appDir of workspaceDirs('apps')) {
  const pkg = readJson(`${appDir}/package.json`);
  const imports = importedLocalPackages(appDir, localPackages);
  const nextConfig = nextConfigPath(appDir);
  const transpiled = transpilePackages(nextConfig);

  for (const [packageName, files] of imports) {
    if (!hasDeclaredDependency(pkg, packageName)) {
      failures.push(
        `${appDir}/package.json is missing ${packageName}. Add "${packageName}": "0.0.0" to dependencies. Imported by: ${[
          ...files,
        ]
          .slice(0, 5)
          .join(', ')}`,
      );
    }

    if (transpiled && !transpiled.has(packageName)) {
      failures.push(
        `${nextConfig} transpilePackages is missing ${packageName}. Add it because ${appDir} imports this local workspace package.`,
      );
    }
  }
}

if (failures.length) {
  console.error('package-boundary-guard: failed\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`package-boundary-guard: clean (${localPackages.size} local packages checked)`);
