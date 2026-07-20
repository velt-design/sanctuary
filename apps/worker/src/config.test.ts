import { describe, expect, it } from 'vitest';

import { BACKGROUND_JOB_WORKER_ENV, loadWorkerConfig, WorkerConfigurationError } from './config';

const requiredEnvironment = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-value',
} as const;

const identity = {
  hostname: () => 'worker host',
  processId: 42,
  randomUuid: () => '12345678-1234-4234-9234-123456789abc',
};

describe('loadWorkerConfig', () => {
  it('defaults to a dark worker with a generated safe identity', () => {
    const config = loadWorkerConfig(requiredEnvironment, { identity });

    expect(config).toMatchObject({
      mode: 'dark',
      activeExecutionEnabled: false,
      workerId: 'worker-host:42:12345678-1234-4234-9234-123456789abc',
      globalConcurrency: 4,
      visibilityTimeoutSeconds: 120,
      heartbeatIntervalMs: 30_000,
      workerHeartbeatIntervalMs: 15_000,
      healthPort: 8_080,
    });
    expect(config.concurrencyByClass).toEqual({});
    expect(config.concurrencyByKind).toEqual({});
  });

  it('adds a per-boot suffix to a configured worker prefix', () => {
    const first = loadWorkerConfig(
      { ...requiredEnvironment, BACKGROUND_JOBS_WORKER_ID: 'worker-slot-1' },
      { identity },
    );
    const second = loadWorkerConfig(
      { ...requiredEnvironment, BACKGROUND_JOBS_WORKER_ID: 'worker-slot-1' },
      {
        identity: {
          ...identity,
          randomUuid: () => 'abcdef12-1234-4234-9234-123456789abc',
        },
      },
    );

    expect(first.workerId).toBe('worker-slot-1:12345678-1234-4234-9234-123456789abc');
    expect(second.workerId).toBe('worker-slot-1:abcdef12-1234-4234-9234-123456789abc');
    expect(second.workerId).not.toBe(first.workerId);
  });

  it.each(['active', 'once', 'drain'] as const)('requires an explicit execution gate for %s mode', (mode) => {
    expect(() => loadWorkerConfig({ ...requiredEnvironment, BACKGROUND_JOBS_WORKER_MODE: mode })).toThrow(
      new WorkerConfigurationError(
        `${BACKGROUND_JOB_WORKER_ENV.activeExecutionEnabled} must be true before ${mode} mode can execute jobs`,
      ),
    );
  });

  it('parses bounded per-class and per-kind concurrency', () => {
    const config = loadWorkerConfig({
      ...requiredEnvironment,
      BACKGROUND_JOBS_WORKER_MODE: 'active',
      BACKGROUND_JOBS_WORKER_ACTIVE_ENABLED: 'true',
      BACKGROUND_JOBS_WORKER_GLOBAL_CONCURRENCY: '8',
      BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_CLASS: 'email=3,documents=2',
      BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_KIND: 'quote_send=2,job_pack_generate=1',
    });

    expect(config.concurrencyByClass).toEqual({ email: 3, documents: 2 });
    expect(config.concurrencyByKind).toEqual({ quote_send: 2, job_pack_generate: 1 });
  });

  it('allows non-executing reconciliation without the active gate', () => {
    expect(loadWorkerConfig({ ...requiredEnvironment, BACKGROUND_JOBS_WORKER_MODE: 'reconcile' }).mode).toBe(
      'reconcile',
    );
  });

  it('fails closed when heartbeat loss cannot settle before lease visibility expires', () => {
    expect(() =>
      loadWorkerConfig({
        ...requiredEnvironment,
        BACKGROUND_JOBS_WORKER_VISIBILITY_TIMEOUT_SECONDS: '60',
        BACKGROUND_JOBS_WORKER_HEARTBEAT_INTERVAL_MS: '15000',
        BACKGROUND_JOBS_WORKER_RPC_TIMEOUT_MS: '30000',
        BACKGROUND_JOBS_WORKER_ABORT_SETTLE_GRACE_MS: '10000',
      }),
    ).toThrow(/VISIBILITY_TIMEOUT_SECONDS/);

    expect(
      loadWorkerConfig({
        ...requiredEnvironment,
        BACKGROUND_JOBS_WORKER_VISIBILITY_TIMEOUT_SECONDS: '60',
        BACKGROUND_JOBS_WORKER_HEARTBEAT_INTERVAL_MS: '10000',
        BACKGROUND_JOBS_WORKER_RPC_TIMEOUT_MS: '30000',
        BACKGROUND_JOBS_WORKER_ABORT_SETTLE_GRACE_MS: '10000',
      }).visibilityTimeoutSeconds,
    ).toBe(60);
  });

  it('fails closed when worker heartbeat RPCs can exceed the stale-worker threshold', () => {
    expect(() =>
      loadWorkerConfig({
        ...requiredEnvironment,
        BACKGROUND_JOBS_WORKER_RPC_TIMEOUT_MS: '60000',
      }),
    ).toThrow(/RECORD_HEARTBEAT_INTERVAL_MS/);
  });

  it.each([
    ['BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_CLASS', 'email=2,email=1'],
    ['BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_CLASS', 'unknown=1'],
    ['BACKGROUND_JOBS_WORKER_CONCURRENCY_BY_KIND', 'quote_send=5'],
    ['BACKGROUND_JOBS_WORKER_HEARTBEAT_INTERVAL_MS', '120000'],
    ['BACKGROUND_JOBS_WORKER_CLAIM_BATCH_SIZE', '5'],
    ['BACKGROUND_JOBS_WORKER_ABORT_SETTLE_GRACE_MS', '31000'],
  ])('rejects unsafe or inconsistent %s settings', (name, value) => {
    expect(() => loadWorkerConfig({ ...requiredEnvironment, [name]: value })).toThrow(WorkerConfigurationError);
  });

  it('does not echo secrets when configuration validation fails', () => {
    const secret = 'service-role-value-that-must-not-be-printed';
    let thrown: unknown;
    try {
      loadWorkerConfig({ SUPABASE_URL: 'not a url', SUPABASE_SERVICE_ROLE_KEY: secret });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).not.toContain(secret);
    expect(String(thrown)).toContain(BACKGROUND_JOB_WORKER_ENV.supabaseUrl);
  });

  it.each([
    ['BACKGROUND_JOBS_WORKER_ID', ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_')],
    ['BACKGROUND_JOBS_WORKER_BUILD_VERSION', '0123456789abcdef0123456789abcdef01234567'],
  ])('rejects sensitive-looking values in safe identifier field %s', (name, value) => {
    expect(() => loadWorkerConfig({ ...requiredEnvironment, [name]: value })).toThrow(WorkerConfigurationError);
  });
});
