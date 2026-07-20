import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_WORKER_MODES,
  isBackgroundJobObviouslySensitiveString,
  type BackgroundJobConcurrencyClass,
  type BackgroundJobKind,
  type BackgroundJobWorkerMode,
} from '@sp/jobs';

const WORKER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const WORKER_ID_PREFIX_PATTERN = /^[A-Za-z0-9._:-]{1,91}$/;
const WORKER_INSTANCE_SUFFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUILD_VERSION_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const HEALTH_HOST_PATTERN = /^[A-Za-z0-9.:-]{1,253}$/;
const ACTIVE_EXECUTION_MODES = new Set<BackgroundJobWorkerMode>(['active', 'once', 'drain']);
const CONCURRENCY_CLASSES = ['documents', 'email', 'orchestration'] as const satisfies readonly BackgroundJobConcurrencyClass[];

const BACKGROUND_JOB_WORKER_LEASE_SAFETY_MARGIN_MS = 5_000;
const BACKGROUND_JOB_WORKER_STALE_THRESHOLD_MS = 120_000;

export const BACKGROUND_JOB_WORKER_ENV = {
  supabaseUrl: 'SUPABASE_URL',
  serviceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
  mode: 'BACKGROUND_JOBS_WORKER_MODE',
  activeExecutionEnabled: 'BACKGROUND_JOBS_WORKER_ACTIVE_ENABLED',
  workerId: 'BACKGROUND_JOBS_WORKER_ID',
  buildVersion: 'BACKGROUND_JOBS_WORKER_BUILD_VERSION',
  globalConcurrency: 'BACKGROUND_JOBS_WORKER_GLOBAL_CONCURRENCY',
  concurrencyByClass: 'BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_CLASS',
  concurrencyByKind: 'BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_KIND',
  visibilityTimeoutSeconds: 'BACKGROUND_JOBS_WORKER_VISIBILITY_TIMEOUT_SECONDS',
  heartbeatIntervalMs: 'BACKGROUND_JOBS_WORKER_HEARTBEAT_INTERVAL_MS',
  workerHeartbeatIntervalMs: 'BACKGROUND_JOBS_WORKER_RECORD_HEARTBEAT_INTERVAL_MS',
  pollIntervalMs: 'BACKGROUND_JOBS_WORKER_POLL_INTERVAL_MS',
  reconciliationIntervalMs: 'BACKGROUND_JOBS_WORKER_RECONCILIATION_INTERVAL_MS',
  reconciliationLimit: 'BACKGROUND_JOBS_WORKER_RECONCILIATION_LIMIT',
  claimBatchSize: 'BACKGROUND_JOBS_WORKER_CLAIM_BATCH_SIZE',
  shutdownGraceMs: 'BACKGROUND_JOBS_WORKER_SHUTDOWN_GRACE_MS',
  abortSettleGraceMs: 'BACKGROUND_JOBS_WORKER_ABORT_SETTLE_GRACE_MS',
  rpcTimeoutMs: 'BACKGROUND_JOBS_WORKER_RPC_TIMEOUT_MS',
  healthHost: 'BACKGROUND_JOBS_WORKER_HEALTH_HOST',
  healthPort: 'BACKGROUND_JOBS_WORKER_HEALTH_PORT',
} as const;

export type WorkerEnvironment = Readonly<Record<string, string | undefined>>;

type WorkerAppConfig = Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
  workerId: string;
  buildVersion: string;
  mode: BackgroundJobWorkerMode;
  activeExecutionEnabled: boolean;
  globalConcurrency: number;
  concurrencyByClass: Readonly<Partial<Record<BackgroundJobConcurrencyClass, number>>>;
  concurrencyByKind: Readonly<Partial<Record<BackgroundJobKind, number>>>;
  visibilityTimeoutSeconds: number;
  heartbeatIntervalMs: number;
  workerHeartbeatIntervalMs: number;
  pollIntervalMs: number;
  reconciliationIntervalMs: number;
  reconciliationLimit: number;
  claimBatchSize: number;
  shutdownGraceMs: number;
  abortSettleGraceMs: number;
  rpcTimeoutMs: number;
  healthHost: string;
  healthPort: number;
}>;

export class WorkerConfigurationError extends Error {
  readonly code = 'WORKER_CONFIGURATION_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'WorkerConfigurationError';
  }
}

type WorkerIdentityDefaults = Readonly<{
  hostname?: () => string;
  processId?: number;
  randomUuid?: () => string;
}>;

type LoadWorkerConfigOptions = Readonly<{
  modeOverride?: BackgroundJobWorkerMode;
  identity?: WorkerIdentityDefaults;
}>;

function configurationError(variableName: string, expectation: string): never {
  throw new WorkerConfigurationError(`${variableName} ${expectation}`);
}

function requiredValue(environment: WorkerEnvironment, variableName: string): string {
  const value = environment[variableName]?.trim();
  if (!value) configurationError(variableName, 'is required');
  return value;
}

function optionalInteger(
  environment: WorkerEnvironment,
  variableName: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = environment[variableName]?.trim();
  if (rawValue === undefined || rawValue === '') return defaultValue;
  if (!/^\d+$/.test(rawValue)) configurationError(variableName, 'must be an integer');
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    configurationError(variableName, `must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function parseMode(value: string | undefined): BackgroundJobWorkerMode {
  const mode = value?.trim() || 'dark';
  if (!(BACKGROUND_JOB_WORKER_MODES as readonly string[]).includes(mode)) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.mode, 'has an unsupported value');
  }
  return mode as BackgroundJobWorkerMode;
}

function parseBooleanGate(environment: WorkerEnvironment, variableName: string): boolean {
  const rawValue = environment[variableName]?.trim();
  if (rawValue === undefined || rawValue === '') return false;
  if (rawValue !== 'true' && rawValue !== 'false') {
    configurationError(variableName, 'must be exactly true or false');
  }
  return rawValue === 'true';
}

function parseConcurrencyMap<Key extends string>(
  environment: WorkerEnvironment,
  variableName: string,
  allowedKeys: readonly Key[],
  globalConcurrency: number,
): Readonly<Partial<Record<Key, number>>> {
  const rawValue = environment[variableName]?.trim();
  if (!rawValue) return Object.freeze({});

  const allowed = new Set<string>(allowedKeys);
  const parsed: Partial<Record<Key, number>> = {};
  for (const rawEntry of rawValue.split(',')) {
    const [rawKey, rawLimit, ...unexpected] = rawEntry.split('=');
    const key = rawKey?.trim();
    const limitText = rawLimit?.trim();
    if (!key || !limitText || unexpected.length > 0 || !allowed.has(key)) {
      configurationError(variableName, 'contains an unsupported entry');
    }
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      configurationError(variableName, 'contains a duplicate entry');
    }
    if (!/^\d+$/.test(limitText)) {
      configurationError(variableName, 'contains a non-integer limit');
    }
    const limit = Number(limitText);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > globalConcurrency) {
      configurationError(variableName, `limits must be between 1 and ${globalConcurrency}`);
    }
    parsed[key as Key] = limit;
  }
  return Object.freeze(parsed);
}

function defaultWorkerId(identity: WorkerIdentityDefaults): string {
  const getHostname = identity.hostname ?? hostname;
  const processId = identity.processId ?? process.pid;
  const getUuid = identity.randomUuid ?? randomUUID;
  const safeHostname = getHostname()
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 64);
  return `${safeHostname || 'worker'}:${processId}:${getUuid()}`.slice(0, 128);
}

function configuredWorkerId(prefix: string, identity: WorkerIdentityDefaults): string {
  if (isBackgroundJobObviouslySensitiveString(prefix) || !WORKER_ID_PREFIX_PATTERN.test(prefix)) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.workerId,
      'must be a safe worker prefix of at most 91 characters',
    );
  }
  const suffix = (identity.randomUuid ?? randomUUID)();
  if (!WORKER_INSTANCE_SUFFIX_PATTERN.test(suffix)) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.workerId, 'could not generate a safe process identity');
  }
  return `${prefix}:${suffix}`;
}

function parseSupabaseUrl(environment: WorkerEnvironment): string {
  const value = requiredValue(environment, BACKGROUND_JOB_WORKER_ENV.supabaseUrl);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    configurationError(BACKGROUND_JOB_WORKER_ENV.supabaseUrl, 'must be a valid HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.supabaseUrl, 'must be a safe HTTP(S) base URL');
  }
  return value.replace(/\/$/, '');
}

export function loadWorkerConfig(
  environment: WorkerEnvironment = process.env,
  options: LoadWorkerConfigOptions = {},
): WorkerAppConfig {
  const mode = options.modeOverride ?? parseMode(environment[BACKGROUND_JOB_WORKER_ENV.mode]);
  const activeExecutionEnabled = parseBooleanGate(
    environment,
    BACKGROUND_JOB_WORKER_ENV.activeExecutionEnabled,
  );
  if (ACTIVE_EXECUTION_MODES.has(mode) && !activeExecutionEnabled) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.activeExecutionEnabled,
      `must be true before ${mode} mode can execute jobs`,
    );
  }

  const configuredWorkerPrefix = environment[BACKGROUND_JOB_WORKER_ENV.workerId]?.trim();
  const workerId = configuredWorkerPrefix
    ? configuredWorkerId(configuredWorkerPrefix, options.identity ?? {})
    : defaultWorkerId(options.identity ?? {});
  if (isBackgroundJobObviouslySensitiveString(workerId) || !WORKER_ID_PATTERN.test(workerId)) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.workerId, 'must be a safe worker identifier');
  }

  const buildVersion = environment[BACKGROUND_JOB_WORKER_ENV.buildVersion]?.trim() || 'local';
  if (isBackgroundJobObviouslySensitiveString(buildVersion) || !BUILD_VERSION_PATTERN.test(buildVersion)) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.buildVersion, 'must be a safe build identifier');
  }

  const globalConcurrency = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.globalConcurrency,
    4,
    1,
    100,
  );
  const visibilityTimeoutSeconds = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.visibilityTimeoutSeconds,
    120,
    15,
    3_600,
  );
  const heartbeatIntervalMs = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.heartbeatIntervalMs,
    30_000,
    1_000,
    1_800_000,
  );
  if (heartbeatIntervalMs > Math.floor((visibilityTimeoutSeconds * 1_000) / 3)) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.heartbeatIntervalMs,
      `must be no more than one third of ${BACKGROUND_JOB_WORKER_ENV.visibilityTimeoutSeconds}`,
    );
  }

  const healthHost = environment[BACKGROUND_JOB_WORKER_ENV.healthHost]?.trim() || '0.0.0.0';
  if (isBackgroundJobObviouslySensitiveString(healthHost) || !HEALTH_HOST_PATTERN.test(healthHost)) {
    configurationError(BACKGROUND_JOB_WORKER_ENV.healthHost, 'must be a safe host name or address');
  }

  const claimBatchSize = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.claimBatchSize,
    Math.min(globalConcurrency, 100),
    1,
    100,
  );
  if (claimBatchSize > globalConcurrency) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.claimBatchSize,
      `must not exceed ${BACKGROUND_JOB_WORKER_ENV.globalConcurrency}`,
    );
  }
  const shutdownGraceMs = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.shutdownGraceMs,
    30_000,
    1_000,
    300_000,
  );
  const abortSettleGraceMs = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.abortSettleGraceMs,
    5_000,
    100,
    60_000,
  );
  if (abortSettleGraceMs > shutdownGraceMs) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.abortSettleGraceMs,
      `must not exceed ${BACKGROUND_JOB_WORKER_ENV.shutdownGraceMs}`,
    );
  }
  const rpcTimeoutMs = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.rpcTimeoutMs,
    15_000,
    1_000,
    60_000,
  );
  const workerHeartbeatIntervalMs = optionalInteger(
    environment,
    BACKGROUND_JOB_WORKER_ENV.workerHeartbeatIntervalMs,
    15_000,
    1_000,
    60_000,
  );
  const leaseSafetyWindowMs =
    heartbeatIntervalMs + rpcTimeoutMs + abortSettleGraceMs + BACKGROUND_JOB_WORKER_LEASE_SAFETY_MARGIN_MS;
  if (leaseSafetyWindowMs >= visibilityTimeoutSeconds * 1_000) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.visibilityTimeoutSeconds,
      'must exceed the heartbeat, RPC timeout, abort-settlement grace, and lease-safety margin',
    );
  }
  if (
    workerHeartbeatIntervalMs + rpcTimeoutMs * 2 + BACKGROUND_JOB_WORKER_LEASE_SAFETY_MARGIN_MS >=
    BACKGROUND_JOB_WORKER_STALE_THRESHOLD_MS
  ) {
    configurationError(
      BACKGROUND_JOB_WORKER_ENV.workerHeartbeatIntervalMs,
      'must leave two RPC timeouts and the safety margin before the stale-worker threshold',
    );
  }

  return Object.freeze({
    supabaseUrl: parseSupabaseUrl(environment),
    serviceRoleKey: requiredValue(environment, BACKGROUND_JOB_WORKER_ENV.serviceRoleKey),
    workerId,
    buildVersion,
    mode,
    activeExecutionEnabled,
    globalConcurrency,
    concurrencyByClass: parseConcurrencyMap(
      environment,
      BACKGROUND_JOB_WORKER_ENV.concurrencyByClass,
      CONCURRENCY_CLASSES,
      globalConcurrency,
    ),
    concurrencyByKind: parseConcurrencyMap(
      environment,
      BACKGROUND_JOB_WORKER_ENV.concurrencyByKind,
      BACKGROUND_JOB_KINDS,
      globalConcurrency,
    ),
    visibilityTimeoutSeconds,
    heartbeatIntervalMs,
    workerHeartbeatIntervalMs,
    pollIntervalMs: optionalInteger(environment, BACKGROUND_JOB_WORKER_ENV.pollIntervalMs, 1_000, 100, 60_000),
    reconciliationIntervalMs: optionalInteger(
      environment,
      BACKGROUND_JOB_WORKER_ENV.reconciliationIntervalMs,
      60_000,
      1_000,
      3_600_000,
    ),
    reconciliationLimit: optionalInteger(
      environment,
      BACKGROUND_JOB_WORKER_ENV.reconciliationLimit,
      500,
      1,
      5_000,
    ),
    claimBatchSize,
    shutdownGraceMs,
    abortSettleGraceMs,
    rpcTimeoutMs,
    healthHost,
    healthPort: optionalInteger(environment, BACKGROUND_JOB_WORKER_ENV.healthPort, 8_080, 1, 65_535),
  });
}
