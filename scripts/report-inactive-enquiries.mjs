import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

for (const envPath of ['.env.agent.local', '.env.local', 'apps/portal/.env.local']) {
  loadEnvFile(path.resolve(ROOT, envPath));
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseDays(argv) {
  const value = argv.find((arg) => arg.startsWith('--days='))?.slice('--days='.length) ?? '30';
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error('--days must be an integer between 1 and 3650.');
  }
  return days;
}

function formatRows(rows) {
  return rows.map((row) => ({
    projectId: row.project_id,
    project: row.project_name,
    stage: row.pipeline_stage,
    state: row.operational_state,
    owner: row.owner_key ?? 'unassigned',
    lastActivity: row.last_activity_at,
    source: row.last_activity_source,
    inactiveDays: row.inactive_for_days,
    futureWait: row.protected_by_future_wait ? row.waiting_until : '',
    fingerprint: row.evidence_fingerprint,
  }));
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  const asOf = new Date().toISOString();
  const supabase = createClient(
    process.env.SUPABASE_URL?.trim() || requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc('project_enquiry_inactivity_report_v1', {
    p_as_of: asOf,
    p_inactive_days: days,
  });
  if (error) {
    throw new Error(
      `Unable to read the inactivity report. Apply the current migrations first. (${error.code ?? 'unknown'})`,
    );
  }

  const rows = formatRows(Array.isArray(data) ? data : []);
  console.log(`Inactive Enquiry dry run - ${rows.length} project(s), more than ${days} days as of ${asOf}`);
  console.log('This command is read-only. Future Waiting projects require explicit review before closure.');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (rows.length) {
    console.table(rows);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Inactive Enquiry report failed.');
  process.exitCode = 1;
});
