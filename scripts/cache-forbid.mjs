import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXCLUDE = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);

const PORTAL_UI_DIRS = ['apps/portal/app', 'apps/portal/components'];
const PORTAL_QUERY_DIR = 'apps/portal/lib/queries';
const PORTAL_API_DIR = 'apps/portal/app/api';

const forbiddenImports = [
  { name: 'SWR', re: /\buseSWR\b|\bSWRConfig\b|from\s+['"]swr['"]/ },
  { name: 'legacy react-query', re: /from\s+['"]react-query['"]/ },
  { name: 'next/cache', re: /from\s+['"]next\/cache['"]|\bunstable_cache\b|\brevalidateTag\b|\brevalidatePath\b/ },
];

const supabaseFrom = /\bsupabase\.from\s*\(/;

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function read(f) {
  return fs.readFileSync(f, 'utf8');
}

const scanRoots = ['apps/portal', 'scripts'].filter((p) => fs.existsSync(path.join(ROOT, p)));
const files = [];
for (const r of scanRoots) files.push(...walk(path.join(ROOT, r)));

const codeFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

const failures = [];

for (const f of codeFiles) {
  const rel = path.relative(ROOT, f);
  const s = read(f);

  for (const rule of forbiddenImports) {
    if (rule.re.test(s)) failures.push(`[${rule.name}] ${rel}`);
  }

  const isPortalUI =
    PORTAL_UI_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep)) &&
    !rel.startsWith(PORTAL_API_DIR + path.sep);

  const isQuery = rel === PORTAL_QUERY_DIR || rel.startsWith(PORTAL_QUERY_DIR + path.sep);

  if (isPortalUI && !isQuery && supabaseFrom.test(s)) {
    failures.push(`[supabase.from() in portal UI] ${rel} (move read to ${PORTAL_QUERY_DIR})`);
  }
}

if (failures.length) {
  console.error('❌ Forbidden legacy caching / invalid data access detected:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
} else {
  console.log('✅ cache-forbid: clean (portal)');
}
