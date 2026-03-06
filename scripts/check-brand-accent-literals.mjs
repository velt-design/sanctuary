import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['apps/portal', 'apps/marketing'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'vendor', '.git']);
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.json', '.sql']);

const FORBIDDEN = [
  { label: '#813f39', regex: /#813f39/i },
  { label: '#804039', regex: /#804039/i },
  { label: '#6f332f', regex: /#6f332f/i },
  { label: '#7a3b3b', regex: /#7a3b3b/i },
  { label: '#76352f', regex: /#76352f/i },
  { label: '#b84c37', regex: /#b84c37/i },
  { label: 'rgba(129, 63, 57, ...)', regex: /rgba\(\s*129\s*,\s*63\s*,\s*57\s*,/i },
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

const violations = [];

for (const relRoot of SCAN_ROOTS) {
  const absRoot = path.join(ROOT, relRoot);
  if (!fs.existsSync(absRoot)) continue;
  const files = walk(absRoot);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of FORBIDDEN) {
      if (rule.regex.test(content)) {
        violations.push({ file, label: rule.label });
      }
    }
  }
}

if (violations.length) {
  console.error('Found legacy accent literals. Use @sp/theme token(s) instead.');
  for (const v of violations) {
    const rel = path.relative(ROOT, v.file).replaceAll('\\', '/');
    console.error(`- ${rel}: ${v.label}`);
  }
  process.exit(1);
}

console.log('Brand accent literal check passed.');
