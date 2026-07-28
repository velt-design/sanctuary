import fs from 'node:fs';
import path from 'node:path';
import {
  changedFilesFromGit,
  changedModeDescription,
  changedStatusMap,
  toPosix,
} from './changed-file-utils.mjs';

const ROOT = process.cwd();
const CHANGED_ONLY = process.argv.includes('--changed');
const STRICT = process.argv.includes('--strict');
const MAX_ROWS = Number.parseInt(process.env.SERVICE_ROLE_REPORT_MAX_ROWS ?? '80', 10);
const CODE_FILE_RE = /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const TEST_FILE_RE = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public', 'test-results', 'vendor']);
const SCAN_ROOTS = ['apps/portal', 'apps/marketing', 'apps/worker', 'components', 'lib', 'scripts'].filter((relPath) =>
  fs.existsSync(path.join(ROOT, relPath)),
);

const SIGNALS = [
  { name: 'SUPABASE_SERVICE_ROLE_KEY', re: /process\.env\.SUPABASE_SERVICE_ROLE_KEY|requiredEnv\s*\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]/ },
  { name: 'supabaseServiceRole', re: /\bsupabaseServiceRole\b/ },
  { name: 'getSupabaseServiceRole', re: /\bgetSupabaseServiceRole\b/ },
  { name: 'getServiceSupabase', re: /\bgetServiceSupabase\b/ },
  {
    name: 'service-role createClient',
    re: /\bcreateClient\s*\([\s\S]*?(SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey|serviceKey|cachedServiceRoleKey|cachedKey)/,
  },
  {
    name: 'service helper import',
    re: /from\s+['"][^'"]*(?:supabaseClient|supabaseService)['"][\s\S]*?\b(?:supabaseServiceRole|getSupabaseServiceRole|getServiceSupabase)\b|\b(?:supabaseServiceRole|getSupabaseServiceRole|getServiceSupabase)\b[\s\S]*?from\s+['"][^'"]*(?:supabaseClient|supabaseService)['"]/,
  },
];

function walkFiles(relDir) {
  const absDir = path.join(ROOT, relDir);
  const results = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const childRel = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...walkFiles(childRel));
    } else if (entry.isFile() && shouldConsiderFile(childRel)) {
      results.push(childRel);
    }
  }
  return results;
}

function shouldConsiderFile(file) {
  if (file === 'scripts/service-role-access-report.mjs') return false;
  if (!CODE_FILE_RE.test(file)) return false;
  if (TEST_FILE_RE.test(file)) return false;
  if (file.endsWith('.d.ts')) return false;
  return true;
}

function changedFiles() {
  return changedFilesFromGit({
    filter: (file) =>
      shouldConsiderFile(file) &&
      SCAN_ROOTS.some((root) => file === root || file.startsWith(`${root}/`)),
  });
}

function statusMap() {
  return changedStatusMap();
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function signalsFor(text) {
  return SIGNALS.filter((signal) => signal.re.test(text)).map((signal) => signal.name);
}

function isCompatibilityHelper(file) {
  return (
    file === 'apps/portal/lib/supabaseClient.ts' ||
    file === 'apps/marketing/lib/supabaseService.ts'
  );
}

function isApprovedServerFlow(file) {
  if (file.startsWith('scripts/')) return true;
  if (
    file === 'apps/worker/src/config.ts' ||
    file === 'apps/worker/src/backgroundJobsRpcClient.ts'
  ) return true;
  if (file.startsWith('apps/portal/app/api/admin/')) return true;
  if (file.startsWith('apps/portal/lib/automation/')) return true;
  if (file === 'apps/portal/lib/backgroundJobs/providerWebhookRepository.ts') return true;
  if (file.startsWith('apps/portal/lib/dashboard/')) return true;
  if (file.startsWith('apps/portal/lib/scheduling/')) return true;
  if (/^apps\/portal\/lib\/(?:commercial|estimates|invoices|quotes)\//.test(file)) return true;
  if (file.startsWith('apps/marketing/app/api/enquiry/')) return true;
  if (/^apps\/marketing\/lib\/(?:quotes|invoices)\//.test(file)) return true;
  return false;
}

function categoryFor(file, state) {
  if (state === 'new') return 'new-growth';
  if (CHANGED_ONLY && state === 'modified') return 'changed';
  if (isCompatibilityHelper(file)) return 'compatibility-helper';
  if (isApprovedServerFlow(file)) return 'approved-server-flow';
  return 'needs-review';
}

function isStrictAllowed(file) {
  return isCompatibilityHelper(file) || isApprovedServerFlow(file);
}

function suggestedOwner(file, category) {
  if (category === 'compatibility-helper') return 'service-role helper boundary; keep server-only';
  if (file.startsWith('scripts/')) return 'operational script; document env and keep out of browser bundles';
  if (file.startsWith('apps/marketing/')) return 'marketing server/public-token or lead-capture owner';
  if (file.startsWith('apps/worker/')) return 'dedicated worker RPC/auth boundary; keep service-role access narrow and server-only';
  if (file.startsWith('apps/portal/lib/automation/')) return 'automation/email/audit owner';
  if (file.startsWith('apps/portal/lib/backgroundJobs/')) return 'background-job provider reconciliation owner';
  if (file.startsWith('apps/portal/lib/dashboard/')) return 'dashboard snapshot server owner';
  if (file.startsWith('apps/portal/lib/scheduling/')) return 'schedule server/RPC command owner';
  if (/^apps\/portal\/lib\/(?:commercial|estimates|invoices|quotes)\//.test(file)) {
    return 'commercial quote/invoice/estimate server-side-effect owner';
  }
  if (file.startsWith('apps/portal/app/api/admin/')) return 'admin API owner';
  if (category === 'new-growth' || category === 'changed') return 'prefer auth-bound server client unless this is an approved server-owned flow';
  return 'review owner doc and either move to approved server flow or document the bypass';
}

function actionFor(row) {
  if (row.category === 'new-growth') {
    return 'strong advisory: avoid new service-role usage unless explicitly server-owned, documented, and not client-reachable';
  }
  if (row.category === 'changed') {
    return 'handoff note required: explain why service-role access remains correct and whether an auth-bound server client would work';
  }
  if (row.category === 'compatibility-helper') {
    return 'helper boundary: keep server-only and do not import into client components';
  }
  if (row.category === 'approved-server-flow') {
    return 'approved server flow: keep the bypass intentional and covered by the owning docs/tests';
  }
  return 'needs review: classify the owner flow or migrate toward auth-bound server access';
}

function pad(value, width) {
  const text = String(value);
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
}

function printRows(rows) {
  const widths = {
    category: Math.max('Category'.length, ...rows.map((row) => row.category.length)),
    state: Math.max('State'.length, ...rows.map((row) => row.state.length)),
    signals: Math.max('Signal'.length, ...rows.map((row) => row.signals.join(', ').length)),
    owner: Math.max('Suggested owner'.length, ...rows.map((row) => row.owner.length)),
  };

  console.log(`${pad('Category', widths.category)}  ${pad('State', widths.state)}  ${pad('Signal', widths.signals)}  ${pad('Suggested owner', widths.owner)}  File`);
  console.log(`${'-'.repeat(widths.category)}  ${'-'.repeat(widths.state)}  ${'-'.repeat(widths.signals)}  ${'-'.repeat(widths.owner)}  ${'-'.repeat(40)}`);

  for (const row of rows) {
    console.log(
      `${pad(row.category, widths.category)}  ${pad(row.state, widths.state)}  ${pad(row.signals.join(', '), widths.signals)}  ${pad(row.owner, widths.owner)}  ${row.file}`,
    );
    console.log(`${' '.repeat(widths.category + widths.state + widths.signals + widths.owner + 8)}${row.action}`);
  }
}

function maybeFailStrict(rows) {
  if (!STRICT) return;

  const failures = rows.filter((row) => row.state === 'new' && !row.strictAllowed);
  if (failures.length === 0) return;

  console.error('');
  console.error('service-role-access-report: strict changed-file check failed');
  console.error('New service-role access is blocked in strict mode unless it is an approved server-owned flow or compatibility helper. Prefer an auth-bound server client unless privileged access is explicitly required:');
  for (const row of failures) {
    console.error(`- ${row.file} (${row.signals.join(', ')}; suggested owner: ${row.owner})`);
  }
  process.exit(1);
}

function main() {
  const states = statusMap();
  const files = CHANGED_ONLY ? changedFiles() : SCAN_ROOTS.flatMap((root) => walkFiles(root));
  const rows = files
    .map((file) => {
      const signals = signalsFor(read(file));
      if (signals.length === 0) return null;
      const state = states.get(file) ?? 'tracked';
      const category = categoryFor(file, state);
      const row = {
        file,
        state,
        signals,
        category,
        strictAllowed: isStrictAllowed(file),
        owner: suggestedOwner(file, category),
      };
      return { ...row, action: actionFor(row) };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const weight = {
        'new-growth': 4,
        changed: 3,
        'needs-review': 2,
        'approved-server-flow': 1,
        'compatibility-helper': 0,
      };
      return weight[b.category] - weight[a.category] || a.file.localeCompare(b.file);
    });

  console.log(`service-role-access-report: ${CHANGED_ONLY ? 'changed-file advisory report' : 'advisory report'}`);
  if (STRICT) console.log('Strict mode: enabled for new service-role access outside approved server flows or compatibility helpers.');
  if (CHANGED_ONLY) console.log(`Changed source: ${changedModeDescription()}`);
  console.log('This is broader than the portal-only service-role allowlist test; it inventories service-role access but does not fail.');
  console.log('Supabase SQL migrations, tests, generated output, public assets, and build output are skipped.');
  console.log('');

  if (rows.length === 0) {
    console.log(CHANGED_ONLY ? 'No changed service-role access detected.' : 'No service-role access detected.');
    return;
  }

  const counts = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${counts['new-growth'] ?? 0} new-growth, ${counts.changed ?? 0} changed, ${counts['needs-review'] ?? 0} needs-review, ${
      counts['approved-server-flow'] ?? 0
    } approved-server-flow, ${counts['compatibility-helper'] ?? 0} compatibility-helper finding(s).`,
  );
  console.log(`Showing ${Math.min(rows.length, MAX_ROWS)} of ${rows.length}. Set SERVICE_ROLE_REPORT_MAX_ROWS to change this.`);
  console.log('');
  printRows(rows.slice(0, MAX_ROWS));

  if (CHANGED_ONLY) {
    console.log('');
    console.log('Handoff cue: if changed service-role access is listed, explain why privileged access is still required and why it is not client-reachable.');
  }
  maybeFailStrict(rows);
}

main();
