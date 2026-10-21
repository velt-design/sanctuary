import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire, isBuiltin } from 'node:module';
const root = resolve(import.meta.dirname, '../..'), marketing = resolve(root, 'apps/marketing');
const output = resolve(marketing, 'data/landing-template.generated.json');
const require = createRequire(resolve(marketing, 'package.json'));
const files = new Map(), dependencies = new Map(), assets = new Map();
function read(path) {
  if (path === output || files.has(path) || !existsSync(path)) return;
  const source = readFileSync(path, 'utf8'); files.set(path, source.replaceAll('\r\n', '\n'));
  // Public photographs/icons referenced by the relevant source closure are part
  // of the reviewed template too. Replacing an image at the same URL invalidates
  // its proof without fencing unrelated repository releases.
  for (const match of source.matchAll(/['"(](\/(?:images|fonts)\/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)['")]/g)) {
    const asset=resolve(marketing,'public',match[1].slice(1));
    if(existsSync(asset)&&statSync(asset).isFile())assets.set(relative(root,asset).replaceAll('\\','/'),createHash('sha256').update(readFileSync(asset)).digest('hex'));
  }
  for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?|@import\s*)['"]([^'"]+)['"]/g)) {
    const name = match[1];
    if (isBuiltin(name)) continue;
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? resolve(marketing, name.slice(2)) : resolve(dirname(path), name);
      const target = [base, ...['.ts','.tsx','.js','.jsx','.css','.json','/index.ts','/index.tsx'].map(ext => base + ext)].find(p => existsSync(p) && statSync(p).isFile());
      if (target) read(target);
    } else {
      try {
        const target = require.resolve(name);
        if (target.startsWith(resolve(root, 'packages'))) { read(target); continue; }
        let directory = dirname(target);
        while (!existsSync(resolve(directory, 'package.json')) && dirname(directory) !== directory) directory = dirname(directory);
        const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
        dependencies.set(pkg.name, pkg.version);
      } catch { /* Type-only imports do not render. Runtime resolution remains Next's gate. */ }
    }
  }
}
for (const name of ['app/layout.tsx','app/auckland-outdoor-living/page.tsx','app/acrylic-roof-pergolas-auckland/page.tsx']) read(resolve(marketing, name));
read(resolve(root, 'scripts/marketing/generate-landing-template.mjs'));
const entries = [...files].map(([path, source]) => [relative(root, path).replaceAll('\\','/'), createHash('sha256').update(source).digest('hex')]).sort((a,b) => a[0].localeCompare(b[0]));
const versions = Object.fromEntries([...dependencies].sort());
const publicAssets=Object.fromEntries([...assets].sort());
const hash = createHash('sha256').update(JSON.stringify({ entries, versions, publicAssets })).digest('hex');
const text = JSON.stringify({ hash, files: entries, dependencies: versions, publicAssets }, null, 2) + '\n';
if (process.argv.includes('--check')) { if (!existsSync(output) || readFileSync(output,'utf8') !== text) throw new Error('Landing template signature is stale.'); }
else writeFileSync(output, text);
