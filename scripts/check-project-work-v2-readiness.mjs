import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const TARGET_ENV = 'PORTAL_PROJECT_WORK_V2_READINESS_TARGET';
const STAGING_REF_ENV = 'PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF';
const PRODUCTION_REF_ENV = 'PORTAL_PRODUCTION_SUPABASE_PROJECT_REF';

export const PROJECT_WORK_V2_MIGRATIONS = Object.freeze({
  foundation: 'supabase/migrations/20260729_000002_project_work_items_v2.sql',
  schemaCache: 'supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql',
  workQueue: 'supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql',
  portfolio: 'supabase/migrations/20260731000002_project_work_portfolio_rollout.sql',
});

const MISSING_MIGRATION_CODES = Object.freeze({
  foundation: 'PROJECT_WORK_V2_MISSING_000002',
  schemaCache: 'PROJECT_WORK_V2_MISSING_000003',
  workQueue: 'PROJECT_WORK_V2_MISSING_000004',
  portfolio: 'PROJECT_WORK_V2_MISSING_20260731000002',
});

const PROBES = Object.freeze([
  {
    id: 'model-marker-table',
    label: 'project_work_model_versions',
    migration: 'foundation',
    kind: 'table',
    path: '/rest/v1/project_work_model_versions?select=project_id&limit=0',
  },
  {
    id: 'operational-state-table',
    label: 'project_operational_states',
    migration: 'foundation',
    kind: 'table',
    path: '/rest/v1/project_operational_states?select=project_id&limit=0',
  },
  {
    id: 'project-relationships',
    label: 'projects to Project Work V2 relationships',
    migration: 'schemaCache',
    kind: 'relationship',
    path:
      '/rest/v1/projects'
      + '?select=id'
      + '%2CworkModel%3Aproject_work_model_versions'
      + '%21project_work_model_versions_project_id_fkey%28model_version%29'
      + '%2CoperationalState%3Aproject_operational_states'
      + '%21project_operational_states_project_id_fkey%28state%29'
      + '&limit=0',
  },
  {
    id: 'work-queue-rpc',
    label: 'project_work_queue_v3',
    migration: 'workQueue',
    kind: 'rpc',
    path: '/rest/v1/rpc/project_work_queue_v3',
    body: {
      p_now: '2026-01-01T00:00:00.000Z',
      p_limit: 1,
    },
  },
  {
    id: 'portfolio-rollout-ledger',
    label: 'project_work_portfolio_rollouts',
    migration: 'portfolio',
    kind: 'table',
    path:
      '/rest/v1/project_work_portfolio_rollouts'
      + '?select=rollout_key&limit=0',
  },
  {
    id: 'projects-index-rpc',
    label: 'staff_projects_index_v2',
    migration: 'portfolio',
    kind: 'rpc',
    path: '/rest/v1/rpc/staff_projects_index_v2',
    body: {
      p_archive: 'all',
      p_search: '',
      p_status: 'all',
      p_due: 'all',
      p_today: '2026-01-01',
      p_page: 1,
      p_page_size: 1,
      p_sort: 'newest',
      p_state: 'all',
      p_stages: null,
    },
  },
  {
    id: 'project-state-counts-rpc',
    label: 'staff_project_state_counts_v1',
    migration: 'portfolio',
    kind: 'rpc',
    path: '/rest/v1/rpc/staff_project_state_counts_v1',
    body: {},
  },
]);

export class ProjectWorkV2ReadinessError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ProjectWorkV2ReadinessError';
    this.code = code;
    this.details = details;
  }
}

function loadEnvFile(filePath, env = process.env) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || env[key] !== undefined) continue;
    let value = cleaned.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
}

export function loadProjectWorkV2ReadinessEnv(env = process.env) {
  for (const envPath of [
    '.env.agent.local',
    '.env.local',
    '.env',
    'apps/portal/.env.local',
    'apps/portal/.env',
  ]) {
    loadEnvFile(path.resolve(ROOT, envPath), env);
  }
  return env;
}

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (value) return value;
  throw new ProjectWorkV2ReadinessError(
    'PROJECT_WORK_V2_TARGET_REJECTED',
    `Missing required environment value: ${name}.`,
  );
}

function normalizeProjectRef(value, name) {
  const projectRef = value.trim().toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      `${name} must be an exact 20-character Supabase project reference.`,
    );
  }
  return projectRef;
}

export function readProjectWorkV2ReadinessConfig(env = process.env) {
  const target = requiredEnv(env, TARGET_ENV).toLowerCase();
  if (target === 'production') {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      'Production is not an allowed Project Work V2 readiness target.',
    );
  }
  if (target !== 'staging') {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      `${TARGET_ENV} must be exactly "staging".`,
    );
  }

  const stagingProjectRef = normalizeProjectRef(
    requiredEnv(env, STAGING_REF_ENV),
    STAGING_REF_ENV,
  );
  const productionProjectRef = env[PRODUCTION_REF_ENV]?.trim()
    ? normalizeProjectRef(env[PRODUCTION_REF_ENV], PRODUCTION_REF_ENV)
    : null;
  if (productionProjectRef && stagingProjectRef === productionProjectRef) {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      'The declared staging project reference matches the declared production reference.',
    );
  }

  const rawSupabaseUrl = requiredEnv(env, 'NEXT_PUBLIC_SUPABASE_URL');
  let supabaseUrl;
  try {
    supabaseUrl = new URL(rawSupabaseUrl);
  } catch {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      'NEXT_PUBLIC_SUPABASE_URL is not a valid URL.',
    );
  }

  const expectedHost = `${stagingProjectRef}.supabase.co`;
  if (
    supabaseUrl.protocol !== 'https:'
    || supabaseUrl.hostname.toLowerCase() !== expectedHost
    || (supabaseUrl.pathname !== '/' && supabaseUrl.pathname !== '')
    || supabaseUrl.username
    || supabaseUrl.password
    || supabaseUrl.search
    || supabaseUrl.hash
  ) {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_TARGET_REJECTED',
      'NEXT_PUBLIC_SUPABASE_URL does not exactly match the declared staging project reference.',
    );
  }

  return {
    target: 'staging',
    projectRef: stagingProjectRef,
    supabaseUrl: supabaseUrl.origin,
    anonKey: requiredEnv(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

function responsePayloadCode(payload) {
  return payload && typeof payload === 'object' && typeof payload.code === 'string'
    ? payload.code
    : '';
}

function responsePayloadMessage(payload) {
  return payload && typeof payload === 'object' && typeof payload.message === 'string'
    ? payload.message
    : '';
}

async function readErrorPayload(response) {
  if (response.ok) {
    response.body?.cancel().catch(() => undefined);
    return {};
  }
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function missingMigrationError(probe, providerCode) {
  const migrationPath = PROJECT_WORK_V2_MIGRATIONS[probe.migration];
  const errorCode = MISSING_MIGRATION_CODES[probe.migration];
  if (!migrationPath || !errorCode) {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_PROBE_FAILED',
      `Readiness probe ${probe.label} has no migration owner.`,
    );
  }
  const suffix = providerCode ? ` Provider code: ${providerCode}.` : '';
  return new ProjectWorkV2ReadinessError(
    errorCode,
    `${probe.label} is not available in the PostgREST schema.${suffix}`,
    [`Apply ${migrationPath} only through the reviewed staging migration process, then rerun this command.`],
  );
}

export function evaluateProjectWorkV2Probe(probe, response, payload = {}) {
  const providerCode = responsePayloadCode(payload);
  const providerMessage = responsePayloadMessage(payload).toLowerCase();

  if (
    probe.kind === 'table'
    && (providerCode === 'PGRST205' || providerCode === '42P01')
  ) {
    throw missingMigrationError(probe, providerCode);
  }

  if (
    probe.kind === 'relationship'
    && (providerCode === 'PGRST200' || providerCode === 'PGRST201')
  ) {
    throw missingMigrationError(probe, providerCode);
  }

  if (probe.kind === 'rpc' && providerCode === 'PGRST202') {
    throw missingMigrationError(probe, providerCode);
  }

  if (response.ok) {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_SECURITY_FAILURE',
      `Anonymous access unexpectedly succeeded for ${probe.label}.`,
      ['Restore the migration grant/RLS contract before any authenticated staging QA.'],
    );
  }

  if (
    (response.status === 401 || response.status === 403)
    && providerCode === '42501'
    && (
      providerMessage.includes('permission denied')
      || providerMessage.includes('access required')
      || providerMessage.includes(probe.label.toLowerCase())
    )
  ) {
    return {
      id: probe.id,
      status: 'present-and-anonymous-denied',
    };
  }

  throw new ProjectWorkV2ReadinessError(
    'PROJECT_WORK_V2_PROBE_FAILED',
    `Unexpected response while checking ${probe.label}: HTTP ${response.status}.`,
    [providerCode ? `Provider code: ${providerCode}.` : 'Provider code was unavailable.'],
  );
}

export async function checkProjectWorkV2Readiness(
  config,
  fetchImplementation = globalThis.fetch,
) {
  if (typeof fetchImplementation !== 'function') {
    throw new ProjectWorkV2ReadinessError(
      'PROJECT_WORK_V2_PROBE_FAILED',
      'A Fetch API implementation is required.',
    );
  }

  const results = [];
  for (const probe of PROBES) {
    let response;
    try {
      response = await fetchImplementation(`${config.supabaseUrl}${probe.path}`, {
        method: probe.kind === 'rpc' ? 'POST' : 'GET',
        headers: {
          apikey: config.anonKey,
          authorization: `Bearer ${config.anonKey}`,
          accept: 'application/json',
          ...(probe.kind === 'rpc' ? { 'content-type': 'application/json' } : {}),
        },
        body: probe.kind === 'rpc' ? JSON.stringify(probe.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProjectWorkV2ReadinessError(
        'PROJECT_WORK_V2_PROBE_FAILED',
        `Could not reach staging while checking ${probe.label}.`,
        [error instanceof Error ? error.message : String(error)],
      );
    }

    const payload = await readErrorPayload(response);
    results.push(evaluateProjectWorkV2Probe(probe, response, payload));
  }
  return results;
}

function printFailure(error) {
  console.error('Project Work V2 readiness preflight failed.');
  if (error instanceof ProjectWorkV2ReadinessError) {
    console.error(`[${error.code}] ${error.message}`);
    for (const detail of error.details) console.error(detail);
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
}

export async function main(env = process.env) {
  try {
    loadProjectWorkV2ReadinessEnv(env);
    const config = readProjectWorkV2ReadinessConfig(env);
    await checkProjectWorkV2Readiness(config);
    console.log(
      'project-work-v2-readiness: ok '
      + '(000002 foundation, 000003 relationships/cache, 000004 queue, and '
      + '20260731000002 cohort ledger/index/state contracts are present; '
      + 'anonymous access remains denied)',
    );
    return 0;
  } catch (error) {
    printFailure(error);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
