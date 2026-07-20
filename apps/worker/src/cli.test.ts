import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  type BackgroundJobKind,
  type BackgroundJobStatus,
  type BackgroundJobWorkerLifecycleState,
  type BackgroundJobsRuntimeMetrics,
} from '@sp/jobs';
import { describe, expect, it } from 'vitest';

import { formatRuntimeMetrics, parseWorkerCliArgs, runWorkerCli, WorkerCliArgumentError } from './cli';
import { createBackgroundJobsRpc, type BackgroundJobsRpcTransport } from './backgroundJobsRpcClient';
import type { RuntimeBackgroundJobsRpc } from './runtime';

function countMap<Values extends readonly string[]>(values: Values): Record<Values[number], number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<Values[number], number>;
}

const metrics: BackgroundJobsRuntimeMetrics = {
  queueDepth: 2,
  oldestMessageAgeSeconds: 3,
  oldestJobAgeSeconds: 4,
  dueJobs: 1,
  nextDueAt: null,
  statusCounts: countMap(BACKGROUND_JOB_STATUSES) as Record<BackgroundJobStatus, number>,
  kindCounts: countMap(BACKGROUND_JOB_KINDS) as Record<BackgroundJobKind, number>,
  workerLifecycleCounts: countMap(BACKGROUND_JOB_WORKER_LIFECYCLE_STATES) as Record<
    BackgroundJobWorkerLifecycleState,
    number
  >,
  staleWorkers: 0,
  measuredAt: '2026-07-20T01:02:03.000Z',
};

function output() {
  const chunks: string[] = [];
  return { chunks, write: (chunk: string) => chunks.push(chunk) };
}

describe('worker CLI', () => {
  it('parses only the documented commands and modes', () => {
    expect(parseWorkerCliArgs([])).toEqual({ command: 'worker' });
    expect(parseWorkerCliArgs(['--mode', 'once'])).toEqual({ command: 'worker', modeOverride: 'once' });
    expect(parseWorkerCliArgs(['--mode=reconcile'])).toEqual({ command: 'worker', modeOverride: 'reconcile' });
    expect(parseWorkerCliArgs(['queue-health'])).toEqual({ command: 'queue-health' });
    expect(parseWorkerCliArgs(['--help'])).toEqual({ command: 'help' });
    expect(() => parseWorkerCliArgs(['--token', 'secret'])).toThrow(WorkerCliArgumentError);
  });

  it('formats only validated aggregate runtime metrics', () => {
    expect(JSON.parse(formatRuntimeMetrics(metrics))).toEqual({
      event: 'background_jobs_runtime_metrics',
      ...metrics,
    });
  });

  it('runs queue-health without constructing or starting a worker', async () => {
    const stdout = output();
    const stderr = output();
    const transport: BackgroundJobsRpcTransport = {
      async call(name) {
        expect(name).toBe('background_jobs_runtime_metrics');
        return {
          data: [
            {
              queue_depth: metrics.queueDepth,
              oldest_message_age_seconds: metrics.oldestMessageAgeSeconds,
              oldest_job_age_seconds: metrics.oldestJobAgeSeconds,
              due_jobs: metrics.dueJobs,
              next_due_at: metrics.nextDueAt,
              status_counts: metrics.statusCounts,
              kind_counts: metrics.kindCounts,
              worker_lifecycle_counts: metrics.workerLifecycleCounts,
              stale_workers: metrics.staleWorkers,
              measured_at: metrics.measuredAt,
            },
          ],
          error: null,
        };
      },
    };

    const exitCode = await runWorkerCli(['queue-health'], {
      environment: {
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
        BACKGROUND_JOBS_WORKER_MODE: 'active',
      },
      stdout,
      stderr,
      createRpc: (options) => createBackgroundJobsRpc({ ...options, transport }),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.chunks.join(''))).toEqual({ event: 'background_jobs_runtime_metrics', ...metrics });
    expect(stderr.chunks).toEqual([]);
  });

  it('reports a fixed error code without echoing invalid argument values', async () => {
    const stdout = output();
    const stderr = output();
    const secret = 'person@example.com?token=private';

    const exitCode = await runWorkerCli(['--mode', secret], { stdout, stderr });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('WORKER_ARGUMENTS_INVALID');
    expect(stderr.chunks.join('')).not.toContain(secret);
  });

  it('hard-exits on an unsettled heartbeat-loss fatal signal before a lease can recover', async () => {
    const stdout = output();
    const stderr = output();
    let observedExitCode: number | null = null;

    const exitCode = await runWorkerCli(['--mode', 'once'], {
      environment: {
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
        BACKGROUND_JOBS_WORKER_ACTIVE_ENABLED: 'true',
      },
      stdout,
      stderr,
      createRpc: () => ({}) as RuntimeBackgroundJobsRpc,
      createWorker: (options) => ({
        run: async () => options.fatalExit('HANDLER_ABORT_UNSETTLED_AFTER_LEASE_LOSS'),
        requestShutdown: () => undefined,
        snapshot: () => ({
          workerId: 'worker-1',
          mode: 'once',
          lifecycleState: 'unhealthy',
          acceptingJobs: false,
          activeJobCount: 1,
          globalConcurrency: 1,
          processedCount: 0,
          succeededCount: 0,
          retryingCount: 0,
          attentionCount: 0,
          failedCount: 0,
          lastQueueHealth: null,
          lastRuntimeMetrics: null,
          startedAt: '2026-07-20T01:02:03.000Z',
          shutdownRequestedAt: null,
        }),
      }),
      processExit: (code) => {
        observedExitCode = code;
        throw new Error('TEST_PROCESS_EXIT');
      },
    });

    expect(exitCode).toBe(1);
    expect(observedExitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('HANDLER_ABORT_UNSETTLED_AFTER_LEASE_LOSS');
  });
});
