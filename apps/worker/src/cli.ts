import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BACKGROUND_JOB_WORKER_MODES,
  type BackgroundJobsRuntimeMetrics,
  type BackgroundJobWorkerMode,
} from '@sp/jobs';

import { backgroundJobHandlers } from './handlers';
import { createBackgroundJobsRpc, BackgroundJobsRpcError } from './backgroundJobsRpcClient';
import { loadWorkerConfig, WorkerConfigurationError, type WorkerEnvironment } from './config';
import { startWorkerHealthServer, type WorkerHealthServer } from './healthServer';
import { createWorkerLogger } from './logger';
import {
  createBackgroundJobWorker,
  type BackgroundJobHandlerRegistry,
  type BackgroundJobWorker,
  type RuntimeBackgroundJobsRpc,
} from './runtime';

const WORKER_USAGE = `Sanctuary background worker

Usage:
  worker                         Run using BACKGROUND_JOBS_WORKER_MODE (dark by default)
  worker --mode <mode>           Run dark, active, once, drain, or reconcile
  worker queue-health            Print safe aggregate queue/runtime metrics and exit
  worker --help                  Show this help
`;

export type WorkerCliCommand =
  | Readonly<{ command: 'help' }>
  | Readonly<{ command: 'queue-health' }>
  | Readonly<{ command: 'worker'; modeOverride?: BackgroundJobWorkerMode }>;

export class WorkerCliArgumentError extends Error {
  readonly code = 'WORKER_ARGUMENTS_INVALID';

  constructor() {
    super('Worker arguments are invalid');
    this.name = 'WorkerCliArgumentError';
  }
}

type Writable = Readonly<{ write(chunk: string): unknown }>;
type SignalSource = Readonly<{
  once(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
  off(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
}>;

type WorkerCliDependencies = Readonly<{
  environment: WorkerEnvironment;
  stdout: Writable;
  stderr: Writable;
  signalSource: SignalSource;
  processExit: (exitCode: number) => never;
  handlers: BackgroundJobHandlerRegistry;
  createRpc: typeof createBackgroundJobsRpc;
  createWorker: typeof createBackgroundJobWorker;
  startHealthServer: typeof startWorkerHealthServer;
  createLogger: typeof createWorkerLogger;
}>;

const defaultDependencies: WorkerCliDependencies = {
  environment: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
  signalSource: process,
  processExit: (exitCode) => process.exit(exitCode),
  handlers: backgroundJobHandlers,
  createRpc: createBackgroundJobsRpc,
  createWorker: createBackgroundJobWorker,
  startHealthServer: startWorkerHealthServer,
  createLogger: createWorkerLogger,
};

export function parseWorkerCliArgs(args: readonly string[]): WorkerCliCommand {
  if (args.length === 0) return { command: 'worker' };
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return { command: 'help' };
  if (args.length === 1 && args[0] === 'queue-health') return { command: 'queue-health' };

  let modeValue: string | undefined;
  if (args.length === 2 && args[0] === '--mode') modeValue = args[1];
  if (args.length === 1 && args[0]?.startsWith('--mode=')) modeValue = args[0].slice('--mode='.length);
  if (!modeValue || !(BACKGROUND_JOB_WORKER_MODES as readonly string[]).includes(modeValue)) {
    throw new WorkerCliArgumentError();
  }
  return { command: 'worker', modeOverride: modeValue as BackgroundJobWorkerMode };
}

export function formatRuntimeMetrics(metrics: BackgroundJobsRuntimeMetrics): string {
  return `${JSON.stringify({
    event: 'background_jobs_runtime_metrics',
    queueDepth: metrics.queueDepth,
    oldestMessageAgeSeconds: metrics.oldestMessageAgeSeconds,
    oldestJobAgeSeconds: metrics.oldestJobAgeSeconds,
    dueJobs: metrics.dueJobs,
    nextDueAt: metrics.nextDueAt,
    statusCounts: metrics.statusCounts,
    kindCounts: metrics.kindCounts,
    workerLifecycleCounts: metrics.workerLifecycleCounts,
    staleWorkers: metrics.staleWorkers,
    measuredAt: metrics.measuredAt,
  })}\n`;
}

function safeFailureCode(error: unknown): string {
  if (error instanceof WorkerCliArgumentError) return error.code;
  if (error instanceof WorkerConfigurationError) return error.code;
  if (error instanceof BackgroundJobsRpcError) return error.code;
  return 'WORKER_FAILED';
}

function runtimeConfiguration(config: ReturnType<typeof loadWorkerConfig>) {
  return {
    workerId: config.workerId,
    buildVersion: config.buildVersion,
    mode: config.mode,
    globalConcurrency: config.globalConcurrency,
    concurrencyByClass: config.concurrencyByClass,
    concurrencyByKind: config.concurrencyByKind,
    claimBatchSize: config.claimBatchSize,
    visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    rpcTimeoutMs: config.rpcTimeoutMs,
    workerHeartbeatIntervalMs: config.workerHeartbeatIntervalMs,
    pollIntervalMs: config.pollIntervalMs,
    reconciliationIntervalMs: config.reconciliationIntervalMs,
    reconciliationLimit: config.reconciliationLimit,
    shutdownGraceMs: config.shutdownGraceMs,
    abortSettleGraceMs: config.abortSettleGraceMs,
  } as const;
}

function healthSnapshot(worker: BackgroundJobWorker) {
  const snapshot = worker.snapshot();
  const lastDatabaseMeasurement = snapshot.lastRuntimeMetrics ?? snapshot.lastQueueHealth;
  return {
    mode: snapshot.mode,
    lifecycleState: snapshot.lifecycleState,
    activeJobCount: snapshot.activeJobCount,
    acceptingJobs: snapshot.acceptingJobs,
    databaseReachable: lastDatabaseMeasurement !== null && snapshot.lifecycleState !== 'unhealthy',
    checkedAt: lastDatabaseMeasurement?.measuredAt ?? snapshot.startedAt,
  } as const;
}

async function runQueueHealth(
  rpc: RuntimeBackgroundJobsRpc,
  output: Writable,
): Promise<void> {
  const metrics = await rpc.runtimeMetrics();
  output.write(formatRuntimeMetrics(metrics));
}

export async function runWorkerCli(
  args: readonly string[] = process.argv.slice(2),
  dependencyOverrides: Partial<WorkerCliDependencies> = {},
): Promise<number> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const logger = dependencies.createLogger({ stdout: dependencies.stdout, stderr: dependencies.stderr });
  let healthServer: WorkerHealthServer | null = null;
  let worker: BackgroundJobWorker | null = null;
  let termHandler: (() => void) | null = null;
  let interruptHandler: (() => void) | null = null;

  try {
    const command = parseWorkerCliArgs(args);
    if (command.command === 'help') {
      dependencies.stdout.write(WORKER_USAGE);
      return 0;
    }

    const config = loadWorkerConfig(dependencies.environment, {
      ...(command.command === 'queue-health'
        ? { modeOverride: 'dark' as const }
        : command.modeOverride
          ? { modeOverride: command.modeOverride }
          : {}),
    });
    const rpc = dependencies.createRpc({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
      timeoutMs: config.rpcTimeoutMs,
    });
    if (command.command === 'queue-health') {
      await runQueueHealth(rpc, dependencies.stdout);
      return 0;
    }

    worker = dependencies.createWorker({
      config: runtimeConfiguration(config),
      rpc,
      logger,
      handlers: dependencies.handlers,
      fatalExit: (errorCode) => {
        logger.error('worker_fatal_exit', { errorCode });
        return dependencies.processExit(1);
      },
    });

    const requestShutdown = (signal: 'SIGTERM' | 'SIGINT') => {
      logger.info('worker_shutdown_requested', { workerId: config.workerId, signal });
      worker?.requestShutdown(signal.toLowerCase());
    };
    termHandler = () => requestShutdown('SIGTERM');
    interruptHandler = () => requestShutdown('SIGINT');
    dependencies.signalSource.once('SIGTERM', termHandler);
    dependencies.signalSource.once('SIGINT', interruptHandler);

    if (config.mode === 'active' || config.mode === 'dark') {
      healthServer = await dependencies.startHealthServer({
        host: config.healthHost,
        port: config.healthPort,
        getSnapshot: () => healthSnapshot(worker as BackgroundJobWorker),
      });
      logger.info('worker_health_server_started', { workerId: config.workerId, mode: config.mode });
    }

    await worker.run();
    return 0;
  } catch (error) {
    logger.error('worker_command_failed', { errorCode: safeFailureCode(error) });
    return 1;
  } finally {
    if (termHandler) dependencies.signalSource.off('SIGTERM', termHandler);
    if (interruptHandler) dependencies.signalSource.off('SIGINT', interruptHandler);
    if (healthServer) {
      try {
        await healthServer.close();
      } catch {
        logger.warn('worker_health_server_close_failed', { errorCode: 'HEALTH_SERVER_CLOSE_FAILED' });
      }
    }
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === resolve(fileURLToPath(import.meta.url)));
}

if (isMainModule()) {
  void runWorkerCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
