import {
  BACKGROUND_JOB_KINDS,
  getBackgroundJobDefinition,
  type BackgroundJobClaim,
  type BackgroundJobKind,
  type BackgroundJobsRuntimeMetrics,
  type BackgroundJobWorkerLifecycleState,
} from '@sp/jobs';

import { BackgroundJobConcurrencyController } from './concurrency';
import type {
  BackgroundJobExecutionResult,
  BackgroundJobHandlerRegistry,
  BackgroundJobWorker,
  BackgroundJobWorkerConfig,
  BackgroundJobWorkerRunResult,
  BackgroundJobWorkerSnapshot,
  RuntimeBackgroundJobsRpc,
  RuntimeClock,
  RuntimeLogger,
} from './contracts';
import { systemRuntimeClock } from './contracts';
import { BackgroundJobAbortError } from './errors';
import { executeBackgroundJob } from './executeJob';

type CreateBackgroundJobWorkerOptions = Readonly<{
  config: BackgroundJobWorkerConfig;
  rpc: RuntimeBackgroundJobsRpc;
  logger: RuntimeLogger;
  handlers: BackgroundJobHandlerRegistry;
  clock?: RuntimeClock;
  /** Must synchronously terminate the process and never return. */
  fatalExit(errorCode: string): never;
}>;

const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const TERMINAL_STATUSES = new Set<string>([
  'succeeded',
  'cancelled',
  'needs_attention',
  'permanent_failed',
]);

function validateConfig(config: BackgroundJobWorkerConfig): void {
  if (!SAFE_ID.test(config.workerId)) throw new RangeError('Worker ID must be a safe identifier');
  if (!SAFE_ID.test(config.buildVersion)) throw new RangeError('Build version must be a safe identifier');
  const boundedIntegers: ReadonlyArray<readonly [string, number, number, number]> = [
    ['claimBatchSize', config.claimBatchSize, 1, 100],
    ['visibilityTimeoutSeconds', config.visibilityTimeoutSeconds, 15, 3_600],
    ['heartbeatIntervalMs', config.heartbeatIntervalMs, 100, 1_800_000],
    ['workerHeartbeatIntervalMs', config.workerHeartbeatIntervalMs, 100, 60_000],
    ['pollIntervalMs', config.pollIntervalMs, 10, 60_000],
    ['reconciliationIntervalMs', config.reconciliationIntervalMs, 100, 3_600_000],
    ['reconciliationLimit', config.reconciliationLimit, 1, 5_000],
    ['shutdownGraceMs', config.shutdownGraceMs, 100, 300_000],
    ['abortSettleGraceMs', config.abortSettleGraceMs, 100, 60_000],
    ['rpcTimeoutMs', config.rpcTimeoutMs, 100, 60_000],
  ];
  for (const [name, value, minimum, maximum] of boundedIntegers) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
    }
  }
  if (config.claimBatchSize > config.globalConcurrency) {
    throw new RangeError('Claim batch size must not exceed global concurrency');
  }
  if (config.heartbeatIntervalMs * 3 > config.visibilityTimeoutSeconds * 1_000) {
    throw new RangeError('Job heartbeat interval must be at most one third of queue visibility');
  }
  if (
    config.heartbeatIntervalMs + config.rpcTimeoutMs + config.abortSettleGraceMs + 5_000 >=
    config.visibilityTimeoutSeconds * 1_000
  ) {
    throw new RangeError('Lease safety budget must remain below queue visibility timeout');
  }
  if (config.workerHeartbeatIntervalMs + config.rpcTimeoutMs * 2 + 5_000 >= 120_000) {
    throw new RangeError('Worker heartbeat budget must remain below the database stale-worker threshold');
  }
}

function handlerKinds(handlers: BackgroundJobHandlerRegistry): readonly BackgroundJobKind[] {
  return Object.keys(handlers).filter((kind): kind is BackgroundJobKind => Boolean(handlers[kind as BackgroundJobKind]));
}

function unfinishedCount(metrics: BackgroundJobsRuntimeMetrics): number {
  return Object.entries(metrics.statusCounts).reduce(
    (total, [status, count]) => total + (TERMINAL_STATUSES.has(status) ? 0 : count),
    0,
  );
}

class BackgroundJobWorkerRuntime implements BackgroundJobWorker {
  readonly #config: BackgroundJobWorkerConfig;
  readonly #rpc: RuntimeBackgroundJobsRpc;
  readonly #logger: RuntimeLogger;
  readonly #handlers: BackgroundJobHandlerRegistry;
  readonly #clock: RuntimeClock;
  readonly #fatalExit: (errorCode: string) => never;
  readonly #concurrency: BackgroundJobConcurrencyController;
  readonly #inFlight = new Map<string, Promise<void>>();
  readonly #forceAbortController = new AbortController();
  readonly #wakeController = new AbortController();
  readonly #workerHeartbeatStop = new AbortController();
  #shutdownGraceController: AbortController | null = null;
  readonly #startedAt: string;

  #lifecycleState: BackgroundJobWorkerLifecycleState = 'starting';
  #acceptingJobs = false;
  #shutdownRequestedAt: string | null = null;
  #processedCount = 0;
  #succeededCount = 0;
  #retryingCount = 0;
  #attentionCount = 0;
  #failedCount = 0;
  #lastQueueHealth: BackgroundJobWorkerSnapshot['lastQueueHealth'] = null;
  #lastRuntimeMetrics: BackgroundJobWorkerSnapshot['lastRuntimeMetrics'] = null;
  #lastReconciliationAtMs = Number.NEGATIVE_INFINITY;
  #runStarted = false;
  #fatalErrorCode: string | null = null;

  constructor(options: CreateBackgroundJobWorkerOptions) {
    validateConfig(options.config);
    this.#config = options.config;
    this.#rpc = options.rpc;
    this.#logger = options.logger;
    this.#handlers = options.handlers;
    this.#clock = options.clock ?? systemRuntimeClock;
    this.#fatalExit = options.fatalExit;
    this.#concurrency = new BackgroundJobConcurrencyController({
      global: options.config.globalConcurrency,
      byClass: options.config.concurrencyByClass,
      byKind: options.config.concurrencyByKind,
    });
    this.#startedAt = new Date(this.#clock.now()).toISOString();

    if (['active', 'once', 'drain'].includes(this.#config.mode)) {
      const missingKinds = BACKGROUND_JOB_KINDS.filter((kind) => !this.#handlers[kind]);
      if (missingKinds.length > 0) {
        throw new Error('WORKER_HANDLER_COVERAGE_INCOMPLETE');
      }
    }
  }

  snapshot(): BackgroundJobWorkerSnapshot {
    return {
      workerId: this.#config.workerId,
      mode: this.#config.mode,
      lifecycleState: this.#lifecycleState,
      acceptingJobs: this.#acceptingJobs,
      activeJobCount: this.#inFlight.size,
      globalConcurrency: this.#config.globalConcurrency,
      processedCount: this.#processedCount,
      succeededCount: this.#succeededCount,
      retryingCount: this.#retryingCount,
      attentionCount: this.#attentionCount,
      failedCount: this.#failedCount,
      lastQueueHealth: this.#lastQueueHealth,
      lastRuntimeMetrics: this.#lastRuntimeMetrics,
      startedAt: this.#startedAt,
      shutdownRequestedAt: this.#shutdownRequestedAt,
    };
  }

  requestShutdown(_reason?: string): void {
    if (this.#shutdownRequestedAt) return;
    this.#shutdownRequestedAt = new Date(this.#clock.now()).toISOString();
    this.#acceptingJobs = false;
    if (this.#lifecycleState !== 'stopped') this.#lifecycleState = 'draining';
    this.#wakeController.abort(new BackgroundJobAbortError('shutdown'));

    if (this.#inFlight.size === 0) return;
    const graceController = new AbortController();
    this.#shutdownGraceController = graceController;
    void this.#clock.sleep(this.#config.shutdownGraceMs, graceController.signal)
      .then(() => {
        if (this.#inFlight.size > 0 && !this.#forceAbortController.signal.aborted) {
          this.#forceAbortController.abort(new BackgroundJobAbortError('shutdown'));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (this.#shutdownGraceController === graceController) this.#shutdownGraceController = null;
      });
  }

  async run(): Promise<BackgroundJobWorkerRunResult> {
    if (this.#runStarted) throw new Error('Background-job worker can run only once');
    this.#runStarted = true;

    this.#logger.info('worker.starting', {
      workerId: this.#config.workerId,
      mode: this.#config.mode,
      globalConcurrency: this.#config.globalConcurrency,
    });

    let heartbeatTask: Promise<void> | null = null;
    try {
      const initialHealth = await this.#publishWorkerState();
      if (!initialHealth && !['active', 'dark'].includes(this.#config.mode)) {
        this.#markUnhealthy('WORKER_STARTUP_UNHEALTHY');
        throw new Error('WORKER_STARTUP_UNHEALTHY');
      }
      if (initialHealth) this.#becomeReady();
      if (initialHealth) {
        const readyHealth = await this.#publishWorkerState();
        if (!readyHealth && !['active', 'dark'].includes(this.#config.mode)) {
          this.#markUnhealthy('WORKER_STARTUP_UNHEALTHY');
          throw new Error('WORKER_STARTUP_UNHEALTHY');
        }
        if (readyHealth) this.#enableAcceptingJobs();
      }
      heartbeatTask = this.#workerHeartbeatLoop();

      switch (this.#config.mode) {
        case 'dark':
          await this.#runDark();
          break;
        case 'active':
          await this.#runActive();
          break;
        case 'once':
          await this.#runOnce();
          break;
        case 'drain':
          await this.#runDrain();
          break;
        case 'reconcile':
          await this.#runReconcile();
          break;
      }

      if (this.#lifecycleState === 'draining' && !this.#fatalErrorCode) {
        await this.#publishWorkerHeartbeat();
      }
      await this.#waitForInFlight();
      if (this.#fatalErrorCode) throw new Error(this.#fatalErrorCode);
      return this.#runResult();
    } catch (error) {
      if (!this.#fatalErrorCode) this.#markUnhealthy('WORKER_RUN_FAILED');
      throw error;
    } finally {
      this.#acceptingJobs = false;
      this.#shutdownGraceController?.abort(new BackgroundJobAbortError('shutdown'));
      this.#shutdownGraceController = null;
      this.#workerHeartbeatStop.abort(new BackgroundJobAbortError('shutdown'));
      if (heartbeatTask) await heartbeatTask;
      this.#lifecycleState = this.#fatalErrorCode ? 'unhealthy' : 'stopped';
      if (!this.#fatalErrorCode) await this.#publishWorkerState();
      this.#logger.info('worker.stopped', {
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        lifecycleState: this.#lifecycleState,
        processedCount: this.#processedCount,
      });
    }
  }

  #becomeReady(): void {
    if (this.#shutdownRequestedAt || this.#fatalErrorCode) return;
    this.#lifecycleState = 'ready';
    this.#acceptingJobs = false;
  }

  #enableAcceptingJobs(): void {
    if (this.#shutdownRequestedAt || this.#fatalErrorCode || this.#lifecycleState !== 'ready') return;
    this.#acceptingJobs = ['active', 'once', 'drain'].includes(this.#config.mode);
  }

  #markUnhealthy(errorCode: string): void {
    if (!this.#fatalErrorCode) this.#fatalErrorCode = errorCode;
    this.#lifecycleState = 'unhealthy';
    this.#acceptingJobs = false;
    if (!this.#shutdownRequestedAt) this.#shutdownRequestedAt = new Date(this.#clock.now()).toISOString();
    this.#wakeController.abort(new BackgroundJobAbortError('shutdown'));
  }

  #runResult(): BackgroundJobWorkerRunResult {
    return {
      mode: this.#config.mode,
      processedCount: this.#processedCount,
      succeededCount: this.#succeededCount,
      retryingCount: this.#retryingCount,
      attentionCount: this.#attentionCount,
      failedCount: this.#failedCount,
    };
  }

  async #workerHeartbeatLoop(): Promise<void> {
    while (!this.#workerHeartbeatStop.signal.aborted) {
      try {
        await this.#clock.sleep(this.#config.workerHeartbeatIntervalMs, this.#workerHeartbeatStop.signal);
      } catch {
        return;
      }
      if (this.#workerHeartbeatStop.signal.aborted) return;
      const healthy = await this.#publishWorkerState();
      if (healthy && this.#lifecycleState === 'unhealthy' && !this.#fatalErrorCode) {
        this.#becomeReady();
        const readyHealth = await this.#publishWorkerState();
        if (readyHealth) this.#enableAcceptingJobs();
      }
    }
  }

  async #publishWorkerState(): Promise<boolean> {
    if (!(await this.#publishWorkerHeartbeat())) return false;
    if (this.#lifecycleState === 'stopped') return true;

    const [queueHealth, runtimeMetrics] = await Promise.allSettled([
      this.#rpc.queueHealth(),
      this.#rpc.runtimeMetrics(),
    ]);
    this.#lastQueueHealth = queueHealth.status === 'fulfilled' ? queueHealth.value : null;
    this.#lastRuntimeMetrics = runtimeMetrics.status === 'fulfilled' ? runtimeMetrics.value : null;
    if (queueHealth.status === 'rejected' || runtimeMetrics.status === 'rejected') {
      if (!this.#fatalErrorCode && !this.#shutdownRequestedAt) {
        this.#lifecycleState = 'unhealthy';
        this.#acceptingJobs = false;
      }
      this.#logger.error('worker.runtime_probe_failed', {
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        errorCode: 'RUNTIME_PROBE_FAILED',
      });
      return false;
    }
    return true;
  }

  async #publishWorkerHeartbeat(): Promise<boolean> {
    const kinds = handlerKinds(this.#handlers);
    const concurrencyClasses = [...new Set(kinds.map((kind) => getBackgroundJobDefinition(kind).concurrencyClass))];
    try {
      await this.#rpc.workerHeartbeat({
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        lifecycleState: this.#lifecycleState,
        buildVersion: this.#config.buildVersion,
        globalConcurrency: this.#config.globalConcurrency,
        activeJobCount: this.#inFlight.size,
        safeMetadata: {
          mode: this.#config.mode,
          lifecycleState: this.#lifecycleState,
          buildVersion: this.#config.buildVersion,
          supportedKinds: kinds,
          concurrencyClasses,
          globalConcurrency: this.#config.globalConcurrency,
          activeJobCount: this.#inFlight.size,
          availableConcurrency: Math.max(0, this.#config.globalConcurrency - this.#inFlight.size),
          ...(this.#lastRuntimeMetrics ? { queueDepth: this.#lastRuntimeMetrics.queueDepth } : {}),
          processedCount: this.#processedCount,
          succeededCount: this.#succeededCount,
          failedCount: this.#failedCount + this.#attentionCount,
          retryingCount: this.#retryingCount,
          acceptingJobs: this.#acceptingJobs,
          drainRequested: this.#shutdownRequestedAt !== null || this.#config.mode === 'drain',
          startedAt: this.#startedAt,
          ...(this.#shutdownRequestedAt ? { shutdownRequestedAt: this.#shutdownRequestedAt } : {}),
        },
      });
    } catch {
      if (!this.#fatalErrorCode && !this.#shutdownRequestedAt) {
        this.#lifecycleState = 'unhealthy';
        this.#acceptingJobs = false;
      }
      this.#logger.error('worker.heartbeat_failed', {
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        errorCode: 'WORKER_HEARTBEAT_FAILED',
      });
      return false;
    }
    return true;
  }

  async #runDark(): Promise<void> {
    while (!this.#shutdownRequestedAt) await this.#sleepForPoll();
  }

  async #runActive(): Promise<void> {
    while (!this.#shutdownRequestedAt && !this.#fatalErrorCode) {
      if (!this.#acceptingJobs) {
        await this.#sleepForPoll();
        continue;
      }
      await this.#reconcileIfDue(this.#lastReconciliationAtMs === Number.NEGATIVE_INFINITY);
      await this.#claimAvailable();
      await this.#waitForWorkOrPoll();
    }
  }

  async #runOnce(): Promise<void> {
    if (!this.#acceptingJobs) return;
    if (!(await this.#claimAvailable())) {
      const errorCode = this.#fatalErrorCode ?? 'CLAIM_FAILED';
      this.#markUnhealthy(errorCode);
      throw new Error(errorCode);
    }
    this.#acceptingJobs = false;
    await this.#waitForInFlight();
  }

  async #runDrain(): Promise<void> {
    await this.#reconcileIfDue(true);
    while (!this.#shutdownRequestedAt && !this.#fatalErrorCode) {
      if (this.#acceptingJobs && !(await this.#claimAvailable())) {
        const errorCode = this.#fatalErrorCode ?? 'CLAIM_FAILED';
        this.#markUnhealthy(errorCode);
        throw new Error(errorCode);
      }
      await this.#waitForInFlight();
      await this.#runReconciliationCycle();
      const metrics = await this.#rpc.runtimeMetrics();
      this.#lastRuntimeMetrics = metrics;
      if (unfinishedCount(metrics) === 0 && metrics.queueDepth === 0) return;

      const nextDueAtMs = metrics.nextDueAt ? Date.parse(metrics.nextDueAt) : Number.NaN;
      const untilNextDueMs = Number.isFinite(nextDueAtMs)
        ? Math.max(0, nextDueAtMs - this.#clock.now())
        : this.#config.pollIntervalMs;
      await this.#sleepForPoll(Math.min(this.#config.pollIntervalMs, untilNextDueMs || this.#config.pollIntervalMs));
    }
  }

  async #runReconcile(): Promise<void> {
    this.#acceptingJobs = false;
    await this.#runReconciliationCycle();
  }

  async #reconcileIfDue(force: boolean): Promise<void> {
    if (!force && this.#clock.now() - this.#lastReconciliationAtMs < this.#config.reconciliationIntervalMs) return;
    try {
      await this.#runReconciliationCycle();
    } catch {
      this.#logger.warn('worker.reconciliation_failed', {
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        errorCode: 'RECONCILIATION_FAILED',
      });
      if (!this.#shutdownRequestedAt && !this.#fatalErrorCode) {
        this.#lifecycleState = 'unhealthy';
        this.#acceptingJobs = false;
      }
    }
  }

  async #runReconciliationCycle(): Promise<void> {
    const reconciled = await this.#rpc.reconcile({
      workerId: this.#config.workerId,
      limit: this.#config.reconciliationLimit,
    });
    this.#lastReconciliationAtMs = this.#clock.now();
    this.#logger.info('worker.reconciled', {
      workerId: this.#config.workerId,
      mode: this.#config.mode,
      recoveredLeases: reconciled.recoveredLeases,
      archivedMessages: reconciled.archivedMessages,
      repairedMessages: reconciled.repairedMessages,
    });
  }

  async #claimAvailable(): Promise<boolean> {
    const available = this.#config.globalConcurrency - this.#inFlight.size;
    if (available <= 0 || !this.#acceptingJobs) return true;

    let claims: readonly BackgroundJobClaim[];
    try {
      claims = await this.#rpc.claim({
        workerId: this.#config.workerId,
        batchSize: Math.min(available, this.#config.claimBatchSize),
        visibilityTimeoutSeconds: this.#config.visibilityTimeoutSeconds,
      });
    } catch {
      this.#lifecycleState = 'unhealthy';
      this.#acceptingJobs = false;
      this.#logger.error('worker.claim_failed', {
        workerId: this.#config.workerId,
        mode: this.#config.mode,
        errorCode: 'CLAIM_FAILED',
      });
      return false;
    }

    const responseJobIds = new Set<string>();
    for (const claim of claims) {
      if (responseJobIds.has(claim.jobId) || this.#inFlight.has(claim.jobId)) {
        this.#logger.error('worker.duplicate_claim', {
          workerId: this.#config.workerId,
          jobId: claim.jobId,
          kind: claim.kind,
          errorCode: 'CLAIM_RESPONSE_INVALID',
        });
        this.#markUnhealthy('CLAIM_RESPONSE_INVALID');
        return false;
      }
      responseJobIds.add(claim.jobId);
    }
    if (claims.length > Math.min(available, this.#config.claimBatchSize)) {
      // Every returned row is already leased. Execute none: starting an
      // unbounded/ambiguous batch is less safe than allowing recovery after
      // this unhealthy worker exits and the leases expire.
      this.#markUnhealthy('CLAIM_RESPONSE_INVALID');
      return false;
    }
    if (!this.#acceptingJobs || this.#shutdownRequestedAt || this.#fatalErrorCode) {
      await this.#releaseUndispatchedClaims(claims);
      return this.#fatalErrorCode === null;
    }
    for (const claim of claims) {
      this.#startClaim(claim);
    }
    return true;
  }

  async #releaseUndispatchedClaims(claims: readonly BackgroundJobClaim[]): Promise<void> {
    await Promise.all(
      claims.map(async (claim) => {
        try {
          await this.#rpc.releaseLease({
            jobId: claim.jobId,
            workerId: this.#config.workerId,
            leaseToken: claim.leaseToken,
          });
        } catch {
          // A failed release is left for lease recovery. The important safety
          // property here is that a stopped or unhealthy worker never dispatches it.
          this.#logger.warn('worker.undispatched_claim_release_failed', {
            workerId: this.#config.workerId,
            jobId: claim.jobId,
            kind: claim.kind,
            errorCode: 'UNDISPATCHED_CLAIM_RELEASE_FAILED',
          });
        }
      }),
    );
  }

  #startClaim(claim: BackgroundJobClaim): void {
    const task = executeBackgroundJob({
      claim,
      workerId: this.#config.workerId,
      rpc: this.#rpc,
      logger: this.#logger,
      clock: this.#clock,
      handler: this.#handlers[claim.kind],
      concurrency: this.#concurrency,
      visibilityTimeoutSeconds: this.#config.visibilityTimeoutSeconds,
      heartbeatIntervalMs: this.#config.heartbeatIntervalMs,
      abortSettleGraceMs: this.#config.abortSettleGraceMs,
      forceAbortSignal: this.#forceAbortController.signal,
      onUnhealthy: (errorCode) => this.#markUnhealthy(errorCode),
      fatalExit: this.#fatalExit,
    })
      .then((executionResult) => this.#recordExecution(executionResult))
      .catch(() => {
        this.#recordExecution({
          jobId: claim.jobId,
          kind: claim.kind,
          outcome: 'deferred',
          errorCode: 'EXECUTION_RUNTIME_FAILED',
          delaySeconds: null,
        });
      })
      .finally(() => {
        this.#inFlight.delete(claim.jobId);
        if (this.#inFlight.size === 0 && this.#shutdownGraceController) {
          this.#shutdownGraceController.abort(new BackgroundJobAbortError('shutdown'));
          this.#shutdownGraceController = null;
        }
      });
    this.#inFlight.set(claim.jobId, task);
  }

  #recordExecution(execution: BackgroundJobExecutionResult): void {
    this.#processedCount += 1;
    switch (execution.outcome) {
      case 'succeeded':
        this.#succeededCount += 1;
        break;
      case 'retrying':
      case 'lease_released':
        this.#retryingCount += 1;
        break;
      case 'needs_attention':
        this.#attentionCount += 1;
        break;
      case 'permanent_failed':
      case 'deferred':
        this.#failedCount += 1;
        break;
      case 'cancelled':
        break;
    }
  }

  async #waitForWorkOrPoll(): Promise<void> {
    if (this.#inFlight.size === 0) {
      await this.#sleepForPoll();
      return;
    }
    const pollController = new AbortController();
    const onWake = () => pollController.abort(new BackgroundJobAbortError('shutdown'));
    this.#wakeController.signal.addEventListener('abort', onWake, { once: true });
    if (this.#wakeController.signal.aborted) onWake();
    try {
      await Promise.race([
        ...this.#inFlight.values(),
        this.#clock.sleep(this.#config.pollIntervalMs, pollController.signal).catch(() => undefined),
      ]);
    } finally {
      pollController.abort(new BackgroundJobAbortError('shutdown'));
      this.#wakeController.signal.removeEventListener('abort', onWake);
    }
  }

  async #waitForInFlight(): Promise<void> {
    while (this.#inFlight.size > 0) await Promise.all([...this.#inFlight.values()]);
  }

  async #sleepForPoll(delayMs = this.#config.pollIntervalMs): Promise<void> {
    if (this.#shutdownRequestedAt) return;
    try {
      await this.#clock.sleep(delayMs, this.#wakeController.signal);
    } catch {
      // Shutdown intentionally wakes the polling loop.
    }
  }
}

export function createBackgroundJobWorker(options: CreateBackgroundJobWorkerOptions): BackgroundJobWorker {
  return new BackgroundJobWorkerRuntime(options);
}
