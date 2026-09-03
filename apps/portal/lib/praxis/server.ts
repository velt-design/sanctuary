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

type ConnectorConfig = {
  databaseUrl: string;
  token: string;
  sourceKey: string;
  connectionId: string;
  environment: string;
};

type CursorPayload = {
  v: 1;
  source: {
    sourceKey: string;
    connectionId: string;
    environment: string;
    projectionVersion: typeof PRAXIS_PROJECTION_VERSION;
  };
  resource: PraxisResource;
  projectId: string | null;
  changedAfter: string | null;
  asOf: string;
  after: { recordedAt: string; resource: PraxisRecordResource; id: string };
};

type ProjectionRow = {
  resource: string;
  id: string;
  project_id: string | null;
  parent_id: string | null;
  recorded_at: Date | string;
  record_version: string;
  payload: unknown;
};

type DatabaseIdentityRow = {
  source_key: string;
  connection_id: string;
  environment: string;
  projection_version: string;
  runtime_role: string;
  group_member: boolean;
  transaction_read_only: boolean;
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
  const config = {
    databaseUrl: requiredEnvironmentValue('PRAXIS_SANCTUARY_DATABASE_URL'),
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

function parseTimestamp(value: string | null, label: string): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', `${label} must be an RFC3339 timestamp.`);
  }
  return date.toISOString();
}

function parseResource(value: string | null): PraxisResource {
  const candidate = value ?? 'all';
  if (!(PRAXIS_RESOURCES as readonly string[]).includes(candidate)) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'resource is not supported.');
  }
  return candidate as PraxisResource;
}

export function parsePraxisContextQuery(url: URL): PraxisContextQuery & { cursor: string | null } {
  const resource = parseResource(url.searchParams.get('resource'));
  const projectId = url.searchParams.get('projectId');
  if (projectId !== null && !UUID_PATTERN.test(projectId)) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'projectId must be a UUID.');
  }
  const changedAfter = parseTimestamp(url.searchParams.get('changedAfter'), 'changedAfter');
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', `limit must be between 1 and ${MAX_LIMIT}.`);
  }
  return { resource, projectId, changedAfter, limit, cursor: url.searchParams.get('cursor') };
}

function signCursor(encodedPayload: string, token: string): string {
  return createHmac('sha256', token).update(encodedPayload).digest('base64url');
}

function encodeCursor(payload: CursorPayload, token: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${signCursor(encodedPayload, token)}`;
}

function decodeCursor(
  value: string,
  query: PraxisContextQuery,
  config: ConnectorConfig,
): CursorPayload {
  try {
    const [encodedPayload, signature, extra] = value.split('.');
    if (!encodedPayload || !signature || extra || !constantTimeEqual(signature, signCursor(encodedPayload, config.token))) {
      throw new Error('invalid signature');
    }
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (
      payload.v !== 1 ||
      payload.source?.sourceKey !== config.sourceKey ||
      payload.source?.connectionId !== config.connectionId ||
      payload.source?.environment !== config.environment ||
      payload.source?.projectionVersion !== PRAXIS_PROJECTION_VERSION ||
      payload.resource !== query.resource ||
      payload.projectId !== query.projectId ||
      payload.changedAfter !== query.changedAfter ||
      typeof payload.asOf !== 'string' ||
      Number.isNaN(new Date(payload.asOf).getTime()) ||
      !payload.after ||
      typeof payload.after.recordedAt !== 'string' ||
      Number.isNaN(new Date(payload.after.recordedAt).getTime()) ||
      !(PRAXIS_RESOURCES as readonly string[]).includes(payload.after.resource) ||
      (payload.after.resource as string) === 'all' ||
      !UUID_PATTERN.test(payload.after.id)
    ) {
      throw new Error('invalid cursor payload');
    }
    return payload as CursorPayload;
  } catch {
    throw new PraxisConnectorError(400, 'INVALID_CURSOR', 'cursor is invalid or does not match this query.');
  }
}

function createDatabase(config: ConnectorConfig): Sql {
  return postgres(config.databaseUrl, {
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
      role.rolcanlogin as can_login,
      role.rolsuper as is_superuser,
      role.rolcreatedb as can_create_database,
      role.rolcreaterole as can_create_role,
      role.rolreplication as can_replicate,
      role.rolbypassrls as can_bypass_rls,
      not exists (
        select 1
        from pg_auth_members membership
        join pg_roles granted_role on granted_role.oid = membership.roleid
        where membership.member = role.oid
          and granted_role.rolname <> 'sanctuary_praxis_reader'
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
      ) as forbidden_sequence_privilege
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
    identity.is_superuser === false &&
    identity.can_create_database === false &&
    identity.can_create_role === false &&
    identity.can_replicate === false &&
    identity.can_bypass_rls === false &&
    identity.only_reporting_membership === true &&
    identity.forbidden_schema_create === false &&
    identity.forbidden_table_privilege === false &&
    identity.forbidden_sequence_privilege === false &&
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
  const { cursor: cursorValue, ...query } = queryWithCursor;
  const cursor = cursorValue ? decodeCursor(cursorValue, query, config) : null;
  const asOf = cursor?.asOf ?? new Date().toISOString();
  const limitWithSentinel = query.limit + 1;
  let rows: ProjectionRow[];
  const client = dependencies.createDatabase(config);
  try {
    rows = await client.begin('read only', async (transaction) => {
      await setReadBudgets(transaction);
      await verifyDatabaseIdentity(transaction, config);
      return transaction<ProjectionRow[]>`
        select resource, id, project_id, parent_id, recorded_at, record_version, payload
        from praxis_reporting.context_page_v1(
          ${query.resource},
          ${query.projectId},
          ${query.changedAfter},
          ${asOf},
          ${cursor?.after.recordedAt ?? null},
          ${cursor?.after.resource ?? null},
          ${cursor?.after.id ?? null},
          ${limitWithSentinel}
        )
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

  const hasMore = rows.length > query.limit;
  const records = rows.slice(0, query.limit).map(mapProjectionRow);
  const last = records.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({
        v: 1,
        source: {
          sourceKey: config.sourceKey,
          connectionId: config.connectionId,
          environment: config.environment,
          projectionVersion: PRAXIS_PROJECTION_VERSION,
        },
        resource: query.resource,
        projectId: query.projectId,
        changedAfter: query.changedAfter,
        asOf,
        after: { recordedAt: last.recordedAt, resource: last.resource, id: last.id },
      }, config.token)
    : null;
  const retrievedAt = new Date().toISOString();
  logPraxisDiagnostic('context_read', { requestId, resource: query.resource, count: records.length, hasMore });
  return {
    schemaVersion: PRAXIS_CONTEXT_SCHEMA_VERSION,
    requestId,
    source: sourceEvidence(config, retrievedAt, asOf),
    query,
    page: { hasMore, nextCursor },
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
    });
  } catch (error) {
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
