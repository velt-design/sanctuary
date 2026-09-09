import 'server-only';

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import {
  PRAXIS_CONTEXT_SCHEMA_VERSION,
  PRAXIS_ERROR_SCHEMA_VERSION,
  PRAXIS_HEALTH_SCHEMA_VERSION,
  PRAXIS_PROJECTION_VERSION,
  PRAXIS_RESOURCES,
  type PraxisContextQuery,
  type PraxisContextRecord,
  type PraxisContextResponse,
  type PraxisErrorCode,
  type PraxisErrorResponse,
  type PraxisHealthResponse,
  type PraxisProjectionEvidence,
  type PraxisRecordResource,
  type PraxisResource,
  type PraxisSourceEvidence,
} from './contract';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD_VERSION_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_VALUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const MIN_TOKEN_LENGTH = 32;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_QUERY_VALUE_LENGTH = 256;
const CONTEXT_QUERY_KEYS = new Set(['resource', 'projectId', 'limit', 'changedAfter', 'cursor']);
const SANITIZER_POLICY_VERSION = 'sanctuary.praxis.sanitizer.v1' as const;
const PROJECTION_CATEGORIES = ['credential_key', 'credential_value', 'source_bounds'] as const;

type ConnectorConfig = {
  databaseUrl: string;
  databaseSsl: false | 'verify-full';
  token: string;
  sourceKey: string;
  connectionId: string;
  environment: string;
};

type ProjectionRow = {
  resource: string;
  id: string;
  project_id: string | null;
  parent_id: string | null;
  recorded_at: Date | string;
  record_version: string;
  payload: unknown;
  policy_version: string;
  redaction_count: number;
  omission_count: number;
  redaction_categories: unknown;
};

type DatabaseIdentityRow = {
  source_key: string;
  connection_id: string;
  environment: string;
  projection_version: string;
  runtime_role: string;
  group_member: boolean;
  transaction_read_only: boolean;
  default_transaction_read_only: boolean;
  service_role_member: boolean;
  can_login: boolean;
  is_superuser: boolean;
  can_create_database: boolean;
  can_create_role: boolean;
  can_replicate: boolean;
  can_bypass_rls: boolean;
  only_reporting_membership: boolean;
  forbidden_schema_create: boolean;
  forbidden_table_privilege: boolean;
  forbidden_sequence_privilege: boolean;
  forbidden_definer_function_privilege: boolean;
};

export type PraxisServerDependencies = {
  createDatabase: (config: ConnectorConfig) => Sql;
};

export class PraxisConnectorError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 503,
    readonly code: PraxisErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'PraxisConnectorError';
  }
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new PraxisConnectorError(
      503,
      'CONNECTOR_NOT_CONFIGURED',
      'The Praxis connector is not configured.',
    );
  }
  return value;
}

export function loadPraxisConnectorConfig(): ConnectorConfig {
  const databaseUrl = requiredEnvironmentValue('PRAXIS_SANCTUARY_DATABASE_URL');
  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const isLoopback = loopbackHosts.has(parsedDatabaseUrl.hostname.toLowerCase());
  const sslMode = parsedDatabaseUrl.searchParams.get('sslmode')?.toLowerCase() ?? null;
  if (!isLoopback && sslMode !== 'verify-full') {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  if (isLoopback && sslMode && sslMode !== 'disable' && sslMode !== 'verify-full') {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }

  const databaseSsl: ConnectorConfig['databaseSsl'] = isLoopback && sslMode !== 'verify-full'
    ? false
    : 'verify-full';
  const config = {
    databaseUrl,
    databaseSsl,
    token: requiredEnvironmentValue('PRAXIS_SANCTUARY_READ_TOKEN'),
    sourceKey: requiredEnvironmentValue('PRAXIS_SANCTUARY_SOURCE_KEY'),
    connectionId: requiredEnvironmentValue('PRAXIS_SANCTUARY_CONNECTION_ID'),
    environment: requiredEnvironmentValue('PRAXIS_SANCTUARY_ENVIRONMENT'),
  };
  if (config.token.length < MIN_TOKEN_LENGTH) {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  if (!SOURCE_VALUE_PATTERN.test(config.sourceKey) || !SOURCE_VALUE_PATTERN.test(config.environment)) {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  if (!UUID_PATTERN.test(config.connectionId)) {
    throw new PraxisConnectorError(503, 'CONNECTOR_NOT_CONFIGURED', 'The Praxis connector is not configured.');
  }
  return config;
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualDigest = createHmac('sha256', expected).update(actual).digest();
  const expectedDigest = createHmac('sha256', expected).update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function authorizePraxisRequest(request: Request, config: ConnectorConfig): void {
  const authorization = request.headers.get('authorization') ?? '';
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!constantTimeEqual(suppliedToken, config.token)) {
    throw new PraxisConnectorError(401, 'UNAUTHORIZED', 'Authentication failed.');
  }

  const bindings = [
    [request.headers.get('x-praxis-source-key') ?? '', config.sourceKey],
    [request.headers.get('x-praxis-connection-id') ?? '', config.connectionId],
    [request.headers.get('x-praxis-environment') ?? '', config.environment],
  ] as const;
  if (bindings.some(([actual, expected]) => !constantTimeEqual(actual, expected))) {
    throw new PraxisConnectorError(403, 'SOURCE_BINDING_MISMATCH', 'The requested source binding is not allowed.');
  }
}

function parseResource(value: string | null): PraxisResource {
  const candidate = value ?? 'all';
  if (!(PRAXIS_RESOURCES as readonly string[]).includes(candidate)) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'resource is not supported.');
  }
  return candidate as PraxisResource;
}

export function parsePraxisContextQuery(url: URL): PraxisContextQuery & { cursor: string | null } {
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!CONTEXT_QUERY_KEYS.has(key) || values.length !== 1 || values[0]!.length > MAX_QUERY_VALUE_LENGTH) {
      throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Query parameters are invalid.');
    }
  }
  if (url.searchParams.has('cursor')) {
    throw new PraxisConnectorError(
      400,
      'INVALID_QUERY',
      'cursor is not supported; Praxis v1 returns one terminal snapshot per request.',
    );
  }
  const resource = parseResource(url.searchParams.get('resource'));
  const projectId = url.searchParams.get('projectId');
  if (projectId !== null && !UUID_PATTERN.test(projectId)) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'projectId must be a UUID.');
  }
  if (url.searchParams.has('changedAfter')) {
    throw new PraxisConnectorError(
      400,
      'INVALID_QUERY',
      'changedAfter is not supported; Praxis v1 reads are full authoritative replacement snapshots.',
    );
  }
  const changedAfter = null;
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', `limit must be between 1 and ${MAX_LIMIT}.`);
  }
  return { resource, projectId, changedAfter, limit, cursor: null };
}

function createDatabase(config: ConnectorConfig): Sql {
  return postgres(config.databaseUrl, {
    ssl: config.databaseSsl,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    max_lifetime: 60,
    prepare: false,
  });
}

const DEFAULT_DEPENDENCIES: PraxisServerDependencies = { createDatabase };

async function verifyDatabaseIdentity(
  transaction: TransactionSql,
  config: ConnectorConfig,
): Promise<void> {
  const rows = await transaction<DatabaseIdentityRow[]>`
    select
      identity.source_key,
      identity.connection_id::text as connection_id,
      identity.environment,
      identity.projection_version,
      current_user::text as runtime_role,
      pg_has_role(current_user, 'sanctuary_praxis_reader', 'member') as group_member,
      current_setting('transaction_read_only') = 'on' as transaction_read_only,
      current_setting('default_transaction_read_only') = 'on' as default_transaction_read_only,
      pg_has_role(current_user, 'service_role', 'member') as service_role_member,
      role.rolcanlogin as can_login,
      role.rolsuper as is_superuser,
      role.rolcreatedb as can_create_database,
      role.rolcreaterole as can_create_role,
      role.rolreplication as can_replicate,
      role.rolbypassrls as can_bypass_rls,
      not exists (
        select 1 from pg_roles granted_role
        where granted_role.rolname not in (current_user::text, 'sanctuary_praxis_reader')
          and pg_has_role(current_user, granted_role.oid, 'member')
      ) as only_reporting_membership,
      exists (
        select 1 from pg_namespace namespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage')
          and has_schema_privilege(current_user, namespace.oid, 'CREATE')
      ) as forbidden_schema_create,
      exists (
        select 1
        from pg_class object
        join pg_namespace namespace on namespace.oid = object.relnamespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage')
          and object.relkind in ('r', 'p', 'v', 'm', 'f')
          and has_table_privilege(
            current_user,
            object.oid,
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          )
      ) as forbidden_table_privilege,
      exists (
        select 1
        from pg_class object
        join pg_namespace namespace on namespace.oid = object.relnamespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage')
          and object.relkind = 'S'
          and has_sequence_privilege(current_user, object.oid, 'USAGE,SELECT,UPDATE')
      ) as forbidden_sequence_privilege,
      exists (
        select 1
        from pg_proc procedure
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname in ('public', 'private', 'auth', 'storage', 'extensions', 'praxis_reporting')
          and procedure.prosecdef
          and procedure.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
          and has_function_privilege(current_user, procedure.oid, 'EXECUTE')
          and procedure.oid not in (
            'praxis_reporting.version_v1(jsonb)'::regprocedure,
            'praxis_reporting.project_financial_truth_for_v1(uuid)'::regprocedure
          )
      ) as forbidden_definer_function_privilege
    from praxis_reporting.source_identity_v1 identity
    join pg_roles role on role.rolname = current_user::text
    where identity.singleton = true
  `;
  const identity = rows[0];
  const exactSource =
    rows.length === 1 &&
    identity?.source_key === config.sourceKey &&
    identity.connection_id === config.connectionId &&
    identity.environment === config.environment &&
    identity.projection_version === PRAXIS_PROJECTION_VERSION;
  const exactPosture =
    identity?.can_login === true &&
    identity.group_member === true &&
    identity.transaction_read_only === true &&
    identity.default_transaction_read_only === true &&
    identity.service_role_member === false &&
    identity.is_superuser === false &&
    identity.can_create_database === false &&
    identity.can_create_role === false &&
    identity.can_replicate === false &&
    identity.can_bypass_rls === false &&
    identity.only_reporting_membership === true &&
    identity.forbidden_schema_create === false &&
    identity.forbidden_table_privilege === false &&
    identity.forbidden_sequence_privilege === false &&
    identity.forbidden_definer_function_privilege === false &&
    !pgRoleHasServiceRole(identity.runtime_role);
  if (!exactSource || !exactPosture) {
    throw new PraxisConnectorError(
      503,
      'PROJECTION_NOT_READY',
      'The Praxis reporting identity is not ready.',
      true,
    );
  }
}

function pgRoleHasServiceRole(runtimeRole: string): boolean {
  return runtimeRole === 'service_role';
}

function sourceEvidence(config: ConnectorConfig, retrievedAt: string, asOf: string): PraxisSourceEvidence {
  return {
    sourceKey: config.sourceKey,
    connectionId: config.connectionId,
    environment: config.environment,
    authority: 'canonical',
    projectionVersion: PRAXIS_PROJECTION_VERSION,
    retrievedAt,
    asOf,
  };
}

function mapProjectionRow(row: ProjectionRow): PraxisContextRecord {
  if (!(PRAXIS_RESOURCES as readonly string[]).includes(row.resource) || row.resource === 'all') {
    throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis projection returned an invalid resource.');
  }
  if (!UUID_PATTERN.test(row.id) || !RECORD_VERSION_PATTERN.test(row.record_version)) {
    throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis projection returned invalid evidence.');
  }
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis projection returned an invalid payload.');
  }
  const categories = row.redaction_categories;
  if (
    row.policy_version !== SANITIZER_POLICY_VERSION ||
    !Number.isInteger(row.redaction_count) || row.redaction_count < 0 ||
    !Number.isInteger(row.omission_count) || row.omission_count < 0 ||
    !Array.isArray(categories) ||
    categories.some((category) => !(PROJECTION_CATEGORIES as readonly unknown[]).includes(category)) ||
    JSON.stringify(categories) !== JSON.stringify([...categories].sort()) ||
    new Set(categories).size !== categories.length
  ) {
    throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis projection returned invalid sanitisation evidence.');
  }
  return {
    resource: row.resource as PraxisRecordResource,
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    recordedAt: new Date(row.recorded_at).toISOString(),
    // The SQL hash is useful for source-side diagnostics. The published
    // version uses this cross-runtime canonical form, shared with Velt.
    recordVersion: canonicalRecordVersion(row.payload as Record<string, unknown>),
    payload: row.payload as Record<string, unknown>,
    projection: {
      policyVersion: SANITIZER_POLICY_VERSION,
      redactionCount: row.redaction_count,
      omissionCount: row.omission_count,
      categories: categories as PraxisProjectionEvidence['categories'],
    },
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

export function canonicalRecordVersion(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

export async function readPraxisContext(
  queryWithCursor: PraxisContextQuery & { cursor: string | null },
  config: ConnectorConfig,
  requestId: string,
  dependencies: PraxisServerDependencies = DEFAULT_DEPENDENCIES,
): Promise<PraxisContextResponse> {
  const { cursor, ...query } = queryWithCursor;
  if (cursor !== null) {
    throw new PraxisConnectorError(
      400,
      'INVALID_QUERY',
      'cursor is not supported; Praxis v1 returns one terminal snapshot per request.',
    );
  }
  const limitWithSentinel = query.limit + 1;
  let snapshot: { asOf: string; rows: ProjectionRow[] };
  const client = dependencies.createDatabase(config);
  try {
    snapshot = await client.begin('read only isolation level repeatable read', async (transaction) => {
      await setReadBudgets(transaction);
      const timestampRows = await transaction<{ as_of: Date | string }[]>`
        select transaction_timestamp() as as_of
      `;
      const asOf = new Date(timestampRows[0]!.as_of).toISOString();
      await verifyDatabaseIdentity(transaction, config);
      const rows = await transaction<ProjectionRow[]>`
        select resource, id, project_id, parent_id, recorded_at, record_version, payload,
          policy_version, redaction_count, omission_count, redaction_categories
        from praxis_reporting.context_page_v1(
          ${query.resource},
          ${query.projectId},
          ${query.changedAfter},
          ${asOf},
          ${null},
          ${null},
          ${null},
          ${limitWithSentinel}
        )
      `;
      return { asOf, rows };
    });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === '42P01' || code === '42883' || code === '42501') {
      throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis reporting projection is not ready.', true);
    }
    if (error instanceof PraxisConnectorError) throw error;
    throw new PraxisConnectorError(503, 'SOURCE_UNAVAILABLE', 'The Sanctuary source is unavailable.', true);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }

  if (snapshot.rows.length > query.limit) {
    throw new PraxisConnectorError(
      400,
      'SNAPSHOT_TOO_LARGE',
      'The snapshot exceeds the requested limit; narrow projectId or resource.',
    );
  }
  const records = snapshot.rows.map(mapProjectionRow);
  const retrievedAt = new Date().toISOString();
  const pageProjection = records.reduce<PraxisProjectionEvidence>((evidence, record) => ({
    policyVersion: SANITIZER_POLICY_VERSION,
    redactionCount: evidence.redactionCount + record.projection.redactionCount,
    omissionCount: evidence.omissionCount + record.projection.omissionCount,
    categories: [...new Set([...evidence.categories, ...record.projection.categories])].sort() as PraxisProjectionEvidence['categories'],
  }), {
    policyVersion: SANITIZER_POLICY_VERSION,
    redactionCount: 0,
    omissionCount: 0,
    categories: [],
  });
  logPraxisDiagnostic('context_read', { requestId, resource: query.resource, count: records.length, hasMore: false });
  return {
    schemaVersion: PRAXIS_CONTEXT_SCHEMA_VERSION,
    requestId,
    source: sourceEvidence(config, retrievedAt, snapshot.asOf),
    query,
    page: { hasMore: false, nextCursor: null, projection: pageProjection },
    records,
  };
}

export async function readPraxisHealth(
  config: ConnectorConfig,
  requestId: string,
  dependencies: PraxisServerDependencies = DEFAULT_DEPENDENCIES,
): Promise<PraxisHealthResponse> {
  const client = dependencies.createDatabase(config);
  try {
    await client.begin('read only', async (transaction) => {
      await setReadBudgets(transaction);
      await verifyDatabaseIdentity(transaction, config);
      const rows = await transaction<{ ready: boolean }[]>`
        select
          has_schema_privilege(current_user, 'praxis_reporting', 'USAGE')
          and has_function_privilege(
            current_user,
            'praxis_reporting.context_page_v1(text,uuid,timestamptz,timestamptz,timestamptz,text,uuid,integer)',
            'EXECUTE'
          ) as ready
      `;
      if (rows[0]?.ready !== true) {
        throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis reporting projection is not ready.', true);
      }
      await transaction`
        select resource
        from praxis_reporting.context_page_v1(
          'all', null, null, now(), null, null, null, 1
        )
        limit 1
      `;
    });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === '42P01' || code === '42883' || code === '42501') {
      throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'The Praxis reporting projection is not ready.', true);
    }
    if (error instanceof PraxisConnectorError) throw error;
    throw new PraxisConnectorError(503, 'SOURCE_UNAVAILABLE', 'The Sanctuary source is unavailable.', true);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
  const retrievedAt = new Date().toISOString();
  logPraxisDiagnostic('health_read', { requestId, ready: true });
  return {
    schemaVersion: PRAXIS_HEALTH_SCHEMA_VERSION,
    requestId,
    source: {
      sourceKey: config.sourceKey,
      connectionId: config.connectionId,
      environment: config.environment,
      authority: 'canonical',
      projectionVersion: PRAXIS_PROJECTION_VERSION,
      retrievedAt,
    },
    status: { connector: 'ready', database: 'reachable', projection: 'ready' },
  };
}

async function setReadBudgets(transaction: TransactionSql): Promise<void> {
  await transaction`set local statement_timeout = '8s'`;
  await transaction`set local lock_timeout = '2s'`;
}

function logPraxisDiagnostic(event: string, metadata: Record<string, string | number | boolean>): void {
  console.info(JSON.stringify({ scope: 'praxis_connector', event, ...metadata }));
}

export function createPraxisErrorResponse(error: unknown, requestId: string): Response {
  const connectorError = error instanceof PraxisConnectorError
    ? error
    : new PraxisConnectorError(503, 'SOURCE_UNAVAILABLE', 'The Sanctuary source is unavailable.', true);
  logPraxisDiagnostic('request_failed', { requestId, code: connectorError.code, status: connectorError.status });
  const body: PraxisErrorResponse = {
    schemaVersion: PRAXIS_ERROR_SCHEMA_VERSION,
    requestId,
    error: {
      code: connectorError.code,
      message: connectorError.message,
      retryable: connectorError.retryable,
    },
  };
  return Response.json(body, { status: connectorError.status, headers: praxisResponseHeaders(requestId) });
}

export function praxisResponseHeaders(requestId: string): HeadersInit {
  return {
    'cache-control': 'private, no-store',
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'x-praxis-request-id': requestId,
    'x-praxis-projection-version': PRAXIS_PROJECTION_VERSION,
  };
}

export function praxisRequestId(): string {
  return randomUUID();
}
