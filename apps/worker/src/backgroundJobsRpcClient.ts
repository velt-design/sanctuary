import { createClient } from '@supabase/supabase-js';
import {
  parseBackgroundJobClaims,
  parseBackgroundJobProtectedPayload,
  parseBackgroundJobReconciliationResult,
  parseBackgroundJobRuntimeContext,
  parseBackgroundJobSafeRecord,
  parseBackgroundJobsQueueHealth,
  parseBackgroundJobsRuntimeMetrics,
  parseBackgroundJobWorkerEffect,
  parseBackgroundJobWorkerEffects,
  parseBackgroundJobWorkerHeartbeat,
  parseBackgroundWorkerSafeRecords,
  type BackgroundJobEffectState,
  type BackgroundJobSafeEffectSummary,
  type BackgroundJobSafeProgressSummary,
  type BackgroundJobSafeRecord,
  type BackgroundJobSafeResultSummary,
  type BackgroundJobStatus,
  type BackgroundJobWorkerLifecycleState,
  type BackgroundJobWorkerMode,
} from '@sp/jobs';

import type { RuntimeBackgroundJobsRpc } from './runtime/contracts';

export const BACKGROUND_JOBS_RPC_NAMES = {
  claim: 'background_jobs_claim',
  readPayload: 'background_job_read_payload',
  readEffects: 'background_job_read_effects',
  readRuntimeContext: 'background_job_read_runtime_context',
  getSafeJob: 'background_job_get_safe',
  heartbeat: 'background_job_heartbeat',
  recordProgress: 'background_job_record_progress',
  recordEffectCheckpoint: 'background_job_record_effect_checkpoint',
  complete: 'background_job_complete',
  scheduleRetry: 'background_job_schedule_retry',
  markNeedsAttention: 'background_job_mark_needs_attention',
  markPermanentFailure: 'background_job_mark_permanent_failure',
  acknowledgeCancellation: 'background_job_acknowledge_cancellation',
  releaseLease: 'background_job_release_lease',
  workerHeartbeat: 'background_worker_heartbeat',
  recoverExpiredLeases: 'background_jobs_recover_expired_leases',
  reconcile: 'background_jobs_reconcile',
  queueHealth: 'background_jobs_queue_health',
  runtimeMetrics: 'background_jobs_runtime_metrics',
  workersListSafe: 'background_workers_list_safe',
} as const;

export type BackgroundJobsRpcName = (typeof BACKGROUND_JOBS_RPC_NAMES)[keyof typeof BACKGROUND_JOBS_RPC_NAMES];

export const BACKGROUND_JOB_SAFE_COLUMNS = [
  'id',
  'kind',
  'contract_version',
  'subject_type',
  'subject_id',
  'project_id',
  'status',
  'current_phase',
  'priority',
  'attempt_count',
  'max_attempts',
  'next_attempt_at',
  'cancellation_requested_at',
  'rollout_mode',
  'execution_owner',
  'safe_progress',
  'safe_result',
  'error_code',
  'created_at',
  'updated_at',
  'started_at',
  'completed_at',
].join(',');

export const BACKGROUND_JOB_EFFECT_COLUMNS = [
  'effect_key',
  'effect_kind',
  'state',
  'payload_hash',
  'provider_name',
  'provider_idempotency_key',
  'provider_idempotency_expires_at',
  'provider_message_id',
  'safe_metadata',
].join(',');

export const BACKGROUND_WORKER_HEARTBEAT_COLUMNS = [
  'worker_id',
  'mode',
  'lifecycle_state',
  'build_version',
  'global_concurrency',
  'active_job_count',
  'safe_metadata',
  'started_at',
  'last_heartbeat_at',
  'shutdown_requested_at',
  'stopped_at',
  'updated_at',
].join(',');

type RpcResponse = Readonly<{ data: unknown; error: unknown | null }>;

export interface BackgroundJobsRpcTransport {
  call(
    name: BackgroundJobsRpcName,
    parameters: Readonly<Record<string, unknown>>,
    selectedColumns?: string,
  ): Promise<RpcResponse>;
}

type CreateBackgroundJobsRpcOptions = Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
  timeoutMs?: number;
  transport?: BackgroundJobsRpcTransport;
}>;

export class BackgroundJobsRpcError extends Error {
  constructor(
    readonly code: 'BACKGROUND_JOBS_RPC_FAILED' | 'BACKGROUND_JOBS_RPC_INVALID_RESPONSE' | 'BACKGROUND_JOBS_RPC_NOT_FOUND',
    readonly rpcName: BackgroundJobsRpcName,
    readonly databaseCode: string | null = null,
  ) {
    super(code);
    this.name = 'BackgroundJobsRpcError';
  }
}

type SupabaseRpcQuery = PromiseLike<RpcResponse> & {
  select(columns: string): SupabaseRpcQuery;
  abortSignal(signal: AbortSignal): SupabaseRpcQuery;
};

function safeDatabaseCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const code = (error as Readonly<Record<string, unknown>>).code;
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : null;
}

function createSupabaseTransport(options: CreateBackgroundJobsRpcOptions): BackgroundJobsRpcTransport {
  const client = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-client-info': 'sanctuary-background-worker' },
    },
  });
  const invoke = client.rpc.bind(client) as unknown as (
    name: BackgroundJobsRpcName,
    parameters: Readonly<Record<string, unknown>>,
  ) => SupabaseRpcQuery;
  const timeoutMs = options.timeoutMs ?? 15_000;

  return Object.freeze({
    async call(
      name: BackgroundJobsRpcName,
      parameters: Readonly<Record<string, unknown>>,
      selectedColumns?: string,
    ) {
      let query = invoke(name, parameters);
      if (selectedColumns) query = query.select(selectedColumns);
      query = query.abortSignal(AbortSignal.timeout(timeoutMs));
      return await query;
    },
  });
}

function oneRow(data: unknown, rpcName: BackgroundJobsRpcName, allowMissing = false): unknown | null {
  if (Array.isArray(data)) {
    if (data.length === 0 && allowMissing) return null;
    if (data.length !== 1) {
      throw new BackgroundJobsRpcError(
        data.length === 0 ? 'BACKGROUND_JOBS_RPC_NOT_FOUND' : 'BACKGROUND_JOBS_RPC_INVALID_RESPONSE',
        rpcName,
      );
    }
    return data[0];
  }
  if (data === null || data === undefined) {
    if (allowMissing) return null;
    throw new BackgroundJobsRpcError('BACKGROUND_JOBS_RPC_NOT_FOUND', rpcName);
  }
  return data;
}

function parseResponse<T>(rpcName: BackgroundJobsRpcName, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof BackgroundJobsRpcError) throw error;
    throw new BackgroundJobsRpcError('BACKGROUND_JOBS_RPC_INVALID_RESPONSE', rpcName);
  }
}

class SupabaseBackgroundJobsRpc implements RuntimeBackgroundJobsRpc {
  constructor(private readonly transport: BackgroundJobsRpcTransport) {}

  private async call(
    rpcName: BackgroundJobsRpcName,
    parameters: Readonly<Record<string, unknown>> = {},
    selectedColumns?: string,
  ): Promise<unknown> {
    let response: RpcResponse;
    try {
      response = await this.transport.call(rpcName, parameters, selectedColumns);
    } catch {
      throw new BackgroundJobsRpcError('BACKGROUND_JOBS_RPC_FAILED', rpcName);
    }
    if (response.error) {
      throw new BackgroundJobsRpcError('BACKGROUND_JOBS_RPC_FAILED', rpcName, safeDatabaseCode(response.error));
    }
    return response.data;
  }

  async claim(input: Readonly<{ workerId: string; batchSize: number; visibilityTimeoutSeconds: number }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.claim;
    const data = await this.call(rpcName, {
      p_worker_id: input.workerId,
      p_batch_size: input.batchSize,
      p_visibility_timeout_seconds: input.visibilityTimeoutSeconds,
    });
    return parseResponse(rpcName, () => parseBackgroundJobClaims(data));
  }

  async readPayload(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.readPayload;
    const data = await this.call(rpcName, ownedParameters(input));
    return parseResponse(rpcName, () => parseBackgroundJobProtectedPayload(oneRow(data, rpcName)));
  }

  async readEffects(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.readEffects;
    const data = await this.call(rpcName, ownedParameters(input), BACKGROUND_JOB_EFFECT_COLUMNS);
    return parseResponse(rpcName, () => parseBackgroundJobWorkerEffects(data));
  }

  async readRuntimeContext(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.readRuntimeContext;
    const data = await this.call(rpcName, ownedParameters(input));
    return parseResponse(rpcName, () => parseBackgroundJobRuntimeContext(oneRow(data, rpcName)));
  }

  async getSafeJob(jobId: string) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.getSafeJob;
    const data = await this.call(rpcName, { p_job_id: jobId }, BACKGROUND_JOB_SAFE_COLUMNS);
    return parseResponse(rpcName, () => {
      const row = oneRow(data, rpcName, true);
      return row === null ? null : parseBackgroundJobSafeRecord(row);
    });
  }

  async heartbeat(
    input: Readonly<{ jobId: string; workerId: string; leaseToken: string; visibilityTimeoutSeconds: number }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.heartbeat, {
      ...ownedParameters(input),
      p_visibility_timeout_seconds: input.visibilityTimeoutSeconds,
    });
  }

  async recordProgress(
    input: Readonly<{
      jobId: string;
      workerId: string;
      leaseToken: string;
      status: BackgroundJobStatus;
      phase: string;
      safeProgress: BackgroundJobSafeProgressSummary;
    }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.recordProgress, {
      ...ownedParameters(input),
      p_status: input.status,
      p_phase: input.phase,
      p_safe_progress: input.safeProgress,
    });
  }

  async recordEffectCheckpoint(
    input: Readonly<{
      jobId: string;
      workerId: string;
      leaseToken: string;
      effectKey: string;
      effectKind: string;
      state: BackgroundJobEffectState;
      payloadHash: string;
      providerName?: string | null;
      providerIdempotencyKey?: string | null;
      providerIdempotencyExpiresAt?: string | null;
      providerMessageId?: string | null;
      safeMetadata?: BackgroundJobSafeEffectSummary;
    }>,
  ) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.recordEffectCheckpoint;
    const data = await this.call(
      rpcName,
      {
        ...ownedParameters(input),
        p_effect_key: input.effectKey,
        p_effect_kind: input.effectKind,
        p_state: input.state,
        p_payload_hash: input.payloadHash,
        p_provider_name: input.providerName ?? null,
        p_provider_idempotency_key: input.providerIdempotencyKey ?? null,
        p_provider_idempotency_expires_at: input.providerIdempotencyExpiresAt ?? null,
        p_provider_message_id: input.providerMessageId ?? null,
        p_safe_metadata: input.safeMetadata ?? {},
      },
      BACKGROUND_JOB_EFFECT_COLUMNS,
    );
    return parseResponse(rpcName, () => parseBackgroundJobWorkerEffect(oneRow(data, rpcName)));
  }

  async complete(
    input: Readonly<{
      jobId: string;
      workerId: string;
      leaseToken: string;
      safeResult: BackgroundJobSafeResultSummary;
    }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.complete, {
      ...ownedParameters(input),
      p_safe_result: input.safeResult,
    });
  }

  async scheduleRetry(
    input: Readonly<{
      jobId: string;
      workerId: string;
      leaseToken: string;
      delaySeconds: number;
      errorCode: string;
    }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.scheduleRetry, {
      ...ownedParameters(input),
      p_delay_seconds: input.delaySeconds,
      p_error_code: input.errorCode,
      p_error_message: input.errorCode,
    });
  }

  async markNeedsAttention(
    input: Readonly<{
      jobId: string;
      workerId: string;
      leaseToken: string;
      errorCode: string;
      safeDetail: BackgroundJobSafeProgressSummary;
    }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.markNeedsAttention, {
      ...ownedParameters(input),
      p_error_code: input.errorCode,
      p_error_message: input.errorCode,
      p_safe_detail: input.safeDetail,
    });
  }

  async markPermanentFailure(
    input: Readonly<{ jobId: string; workerId: string; leaseToken: string; errorCode: string }>,
  ) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.markPermanentFailure, {
      ...ownedParameters(input),
      p_error_code: input.errorCode,
      p_error_message: input.errorCode,
    });
  }

  async acknowledgeCancellation(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.acknowledgeCancellation, ownedParameters(input));
  }

  async releaseLease(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
    return this.safeJobMutation(BACKGROUND_JOBS_RPC_NAMES.releaseLease, ownedParameters(input));
  }

  async workerHeartbeat(
    input: Readonly<{
      workerId: string;
      mode: BackgroundJobWorkerMode;
      lifecycleState: BackgroundJobWorkerLifecycleState;
      buildVersion: string;
      globalConcurrency: number;
      activeJobCount: number;
      safeMetadata: Readonly<Record<string, unknown>>;
    }>,
  ) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.workerHeartbeat;
    const data = await this.call(
      rpcName,
      {
        p_worker_id: input.workerId,
        p_mode: input.mode,
        p_lifecycle_state: input.lifecycleState,
        p_build_version: input.buildVersion,
        p_global_concurrency: input.globalConcurrency,
        p_active_job_count: input.activeJobCount,
        p_safe_metadata: input.safeMetadata,
      },
      BACKGROUND_WORKER_HEARTBEAT_COLUMNS,
    );
    return parseResponse(rpcName, () => parseBackgroundJobWorkerHeartbeat(oneRow(data, rpcName)));
  }

  async recoverExpiredLeases(input: Readonly<{ workerId: string; limit: number }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.recoverExpiredLeases;
    const data = await this.call(rpcName, { p_worker_id: input.workerId, p_limit: input.limit });
    return parseResponse(rpcName, () => {
      if (!Number.isSafeInteger(data) || Number(data) < 0) {
        throw new TypeError('Invalid recovery count');
      }
      return Number(data);
    });
  }

  async reconcile(input: Readonly<{ workerId: string; limit: number }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.reconcile;
    const data = await this.call(rpcName, { p_worker_id: input.workerId, p_limit: input.limit });
    return parseResponse(rpcName, () => parseBackgroundJobReconciliationResult(data));
  }

  async queueHealth() {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.queueHealth;
    const data = await this.call(rpcName);
    return parseResponse(rpcName, () => parseBackgroundJobsQueueHealth(oneRow(data, rpcName)));
  }

  async runtimeMetrics() {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.runtimeMetrics;
    const data = await this.call(rpcName);
    return parseResponse(rpcName, () => parseBackgroundJobsRuntimeMetrics(oneRow(data, rpcName)));
  }

  async workersListSafe(input: Readonly<{ limit: number }>) {
    const rpcName = BACKGROUND_JOBS_RPC_NAMES.workersListSafe;
    const data = await this.call(rpcName, { p_limit: input.limit });
    return parseResponse(rpcName, () => parseBackgroundWorkerSafeRecords(data));
  }

  private async safeJobMutation(
    rpcName: BackgroundJobsRpcName,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<BackgroundJobSafeRecord> {
    const data = await this.call(rpcName, parameters, BACKGROUND_JOB_SAFE_COLUMNS);
    return parseResponse(rpcName, () => parseBackgroundJobSafeRecord(oneRow(data, rpcName)));
  }
}

function ownedParameters(input: Readonly<{ jobId: string; workerId: string; leaseToken: string }>) {
  return {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
  } as const;
}

export function createBackgroundJobsRpc(options: CreateBackgroundJobsRpcOptions): RuntimeBackgroundJobsRpc {
  return new SupabaseBackgroundJobsRpc(options.transport ?? createSupabaseTransport(options));
}
