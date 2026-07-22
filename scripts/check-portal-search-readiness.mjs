import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REQUIRED_MIGRATIONS = {
  portal_search_v1: 'supabase/migrations/20260722_000001_portal_search_v1.sql',
  portal_search_bigrams: 'supabase/migrations/20260722_000002_portal_search_bigram_indexes.sql',
};
const REQUIRED_MATERIALIZED_MIGRATION =
  'supabase/migrations/20260722_000003_portal_search_materialized_columns.sql';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = cleaned.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function fail(lines) {
  console.error('Portal search readiness preflight failed.');
  for (const line of lines) console.error(line);
  process.exitCode = 1;
}

for (const envPath of [
  '.env.agent.local',
  '.env.local',
  '.env',
  'apps/portal/.env.local',
  'apps/portal/.env',
]) {
  loadEnvFile(path.resolve(ROOT, envPath));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '',
    !anonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : '',
  ].filter(Boolean);
  if (missing.length) {
    fail([`Missing required env: ${missing.join(', ')}`]);
    return;
  }

  const probes = [
    {
      functionName: 'portal_search_v1',
      body: { search_query: 'an', result_limit: 1 },
    },
    {
      functionName: 'portal_search_bigrams',
      body: { input_value: 'an' },
    },
  ];

  for (const probe of probes) {
    let response;
    try {
      response = await fetch(`${supabaseUrl}/rest/v1/rpc/${probe.functionName}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(probe.body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      fail([
        'Could not reach the configured Supabase REST endpoint.',
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      return;
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    const code = typeof payload.code === 'string' ? payload.code : '';
    const message = typeof payload.message === 'string' ? payload.message : '';

    if (code === 'PGRST202') {
      fail([
        `The configured database does not expose public.${probe.functionName}.`,
        `Apply ${REQUIRED_MIGRATIONS[probe.functionName]}, then rerun this command.`,
      ]);
      return;
    }

    if (
      (response.status === 401 || response.status === 403)
      && code === '42501'
      && message.toLowerCase().includes(probe.functionName)
    ) {
      continue;
    }

    if (response.ok) {
      fail([
        `Anonymous execution unexpectedly reached ${probe.functionName}.`,
        'Restore the migration grant contract before running authenticated performance evidence.',
      ]);
      return;
    }

    fail([
      `Unexpected Supabase response: ${response.status} ${response.statusText}`,
      code ? `Provider code: ${code}` : 'Provider code was unavailable.',
    ]);
    return;
  }

  let materializedResponse;
  try {
    materializedResponse = await fetch(
      `${supabaseUrl}/rest/v1/projects?select=portal_search_document&limit=0`,
      {
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    fail([
      'Could not verify the materialized portal search columns.',
      `Original error: ${error instanceof Error ? error.message : String(error)}`,
    ]);
    return;
  }

  let materializedPayload = {};
  try {
    materializedPayload = await materializedResponse.json();
  } catch {
    materializedPayload = {};
  }
  const materializedCode = typeof materializedPayload.code === 'string'
    ? materializedPayload.code
    : '';

  if (materializedCode === '42703' || materializedCode === 'PGRST204') {
    fail([
      'The configured database does not expose projects.portal_search_document.',
      `Apply ${REQUIRED_MATERIALIZED_MIGRATION}, then rerun this command.`,
    ]);
    return;
  }

  if (
    !materializedResponse.ok
    && !(
      (materializedResponse.status === 401 || materializedResponse.status === 403)
      && materializedCode === '42501'
    )
  ) {
    fail([
      `Unexpected materialized-column probe response: ${materializedResponse.status} ${materializedResponse.statusText}`,
      materializedCode ? `Provider code: ${materializedCode}` : 'Provider code was unavailable.',
    ]);
    return;
  }

  console.log('portal-search-readiness: ok (RPC, bigram helper, and materialized search columns are deployed)');
}

await main();
