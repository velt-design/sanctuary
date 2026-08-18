import 'server-only';

import {
  AI_ACTOR_KINDS,
  AI_APPROVAL_DECISIONS,
  AI_APPROVAL_STATUSES,
  AI_DATA_CLASSIFICATIONS,
  AI_RISK_CLASSES,
  AI_TASK_EVENT_TYPES,
  AI_TASK_STATUSES,
  type AiTaskStatus,
} from '@sp/ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AiActivityApproval,
  AiActivityApprovalValidation,
  AiActivityEvent,
  AiActivityTaskDetail,
  AiActivityTaskSummary,
} from './activityContract';

export const AI_TASK_SAFE_SELECT = [
  'id',
  'task_type',
  'agent_key',
  'agent_version',
  'capability_key',
  'capability_version',
  'policy_version',
  'safe_objective',
  'status',
  'risk_class',
  'data_classification',
  'project_id',
  'parent_task_id',
  'max_cost_cents',
  'actual_cost_cents',
  'failure_code',
  'safe_failure_summary',
  'created_at',
  'updated_at',
  'started_at',
  'completed_at',
].join(',');

export const AI_TASK_EVENT_SAFE_SELECT = [
  'id',
  'task_id',
  'sequence',
  'event_type',
  'from_status',
  'to_status',
  'actor_kind',
  'actor_key',
  'node_id',
  'safe_summary',
  'created_at',
].join(',');

export const AI_APPROVAL_SAFE_SELECT = [
  'id',
  'task_id',
  'action_type',
  'target_type',
  'target_id',
  'payload_hash',
  'payload_summary',
  'required_role',
  'requested_by_kind',
  'requested_by_key',
  'requested_at',
  'expires_at',
  'single_use',
  'impact',
  'validations',
  'status',
  'decision',
  'decided_by_role',
  'decided_at',
  'consumed_at',
  'invalidation_reason_code',
].join(',');

type RecordValue = Record<string, unknown>;
type ErrorKind = 'unauthorized' | 'forbidden' | 'schema_not_ready' | 'invalid_projection' | 'failed';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export class AiActivityReadError extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = 'AiActivityReadError';
    this.kind = kind;
  }
}

function classifyDatabaseError(error: unknown): AiActivityReadError {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  if (code === 'PGRST301' || code === 'PGRST302') {
    return new AiActivityReadError('unauthorized', 'Portal session is no longer valid');
  }
  if (code === '42501') return new AiActivityReadError('forbidden', 'AI activity is not available');
  if (
    code === '42P01'
    || code === 'PGRST200'
    || code === 'PGRST204'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('schema cache')
  ) {
    return new AiActivityReadError('schema_not_ready', 'AI activity schema is not ready');
  }
  return new AiActivityReadError('failed', 'AI activity read failed');
}

function record(value: unknown, owner: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiActivityReadError('invalid_projection', `${owner} returned an invalid row`);
  }
  return value as RecordValue;
}

function stringValue(row: RecordValue, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value;
}

function nullableString(row: RecordValue, field: string): string | null {
  const value = row[field];
  if (value === null) return null;
  return stringValue(row, field);
}

function uuidValue(row: RecordValue, field: string): string {
  const value = stringValue(row, field);
  if (!UUID_PATTERN.test(value)) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value;
}

function nullableUuid(row: RecordValue, field: string): string | null {
  return row[field] === null ? null : uuidValue(row, field);
}

function sha256Value(row: RecordValue, field: string): string {
  const value = stringValue(row, field);
  if (!SHA256_PATTERN.test(value)) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value;
}

function eventKeyValue(row: RecordValue): string {
  const value = row.id;
  if (
    (typeof value === 'number' && Number.isInteger(value) && value > 0)
    || (typeof value === 'string' && /^[1-9][0-9]*$/.test(value))
  ) return String(value);
  throw new AiActivityReadError('invalid_projection', 'id is invalid');
}

function integerValue(row: RecordValue, field: string, minimum = 0): number {
  const value = row[field];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value as number;
}

function booleanValue(row: RecordValue, field: string): boolean {
  if (typeof row[field] !== 'boolean') {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return row[field] as boolean;
}

function enumValue<const Values extends readonly string[]>(
  row: RecordValue,
  field: string,
  values: Values,
): Values[number] {
  const value = stringValue(row, field);
  if (!values.includes(value)) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value as Values[number];
}

function nullableEnum<const Values extends readonly string[]>(
  row: RecordValue,
  field: string,
  values: Values,
): Values[number] | null {
  return row[field] === null ? null : enumValue(row, field, values);
}

function timestamp(row: RecordValue, field: string): string {
  const value = stringValue(row, field);
  if (!Number.isFinite(Date.parse(value))) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value;
}

function nullableTimestamp(row: RecordValue, field: string): string | null {
  return row[field] === null ? null : timestamp(row, field);
}

function stringArray(row: RecordValue, field: string): string[] {
  const value = row[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new AiActivityReadError('invalid_projection', `${field} is invalid`);
  }
  return value;
}

function mapValidation(value: unknown): AiActivityApprovalValidation {
  const row = record(value, 'ai_approvals.validations');
  return {
    validationKey: stringValue(row, 'validationKey'),
    passed: booleanValue(row, 'passed'),
    evidenceId: nullableUuid(row, 'evidenceId'),
  };
}

function mapAiActivityTask(value: unknown): AiActivityTaskSummary {
  const row = record(value, 'ai_tasks');
  return {
    taskId: uuidValue(row, 'id'),
    taskType: stringValue(row, 'task_type'),
    agentKey: stringValue(row, 'agent_key'),
    agentVersion: stringValue(row, 'agent_version'),
    capabilityKey: stringValue(row, 'capability_key'),
    capabilityVersion: stringValue(row, 'capability_version'),
    policyVersion: stringValue(row, 'policy_version'),
    objective: stringValue(row, 'safe_objective'),
    status: enumValue(row, 'status', AI_TASK_STATUSES),
    riskClass: enumValue(row, 'risk_class', AI_RISK_CLASSES),
    dataClassification: enumValue(row, 'data_classification', AI_DATA_CLASSIFICATIONS),
    projectId: nullableUuid(row, 'project_id'),
    parentTaskId: nullableUuid(row, 'parent_task_id'),
    maxCostCents: integerValue(row, 'max_cost_cents'),
    actualCostCents: integerValue(row, 'actual_cost_cents'),
    failureCode: nullableString(row, 'failure_code'),
    safeFailureSummary: nullableString(row, 'safe_failure_summary'),
    createdAt: timestamp(row, 'created_at'),
    updatedAt: timestamp(row, 'updated_at'),
    startedAt: nullableTimestamp(row, 'started_at'),
    completedAt: nullableTimestamp(row, 'completed_at'),
  };
}

function mapAiActivityEvent(value: unknown): AiActivityEvent {
  const row = record(value, 'ai_task_events');
  const eventType = enumValue(row, 'event_type', AI_TASK_EVENT_TYPES);
  const fromStatus = nullableEnum(row, 'from_status', AI_TASK_STATUSES);
  const toStatus = nullableEnum(row, 'to_status', AI_TASK_STATUSES);
  if (
    (eventType === 'status_changed' && (!fromStatus || !toStatus))
    || (eventType !== 'status_changed' && (fromStatus || toStatus))
  ) {
    throw new AiActivityReadError('invalid_projection', 'event status transition is invalid');
  }
  return {
    eventKey: eventKeyValue(row),
    taskId: uuidValue(row, 'task_id'),
    sequence: integerValue(row, 'sequence', 1),
    eventType,
    fromStatus,
    toStatus,
    actorKind: enumValue(row, 'actor_kind', AI_ACTOR_KINDS),
    actorKey: stringValue(row, 'actor_key'),
    nodeId: nullableString(row, 'node_id'),
    safeSummary: nullableString(row, 'safe_summary'),
    occurredAt: timestamp(row, 'created_at'),
  };
}

function mapAiActivityApproval(value: unknown): AiActivityApproval {
  const row = record(value, 'ai_approvals');
  const validations = row.validations;
  if (!Array.isArray(validations)) {
    throw new AiActivityReadError('invalid_projection', 'validations is invalid');
  }
  const singleUse = booleanValue(row, 'single_use');
  if (!singleUse) throw new AiActivityReadError('invalid_projection', 'single_use is invalid');
  const requestedByKind = stringValue(row, 'requested_by_kind');
  if (requestedByKind !== 'agent') {
    throw new AiActivityReadError('invalid_projection', 'requested_by_kind is invalid');
  }
  const status = enumValue(row, 'status', AI_APPROVAL_STATUSES);
  const decision = nullableEnum(row, 'decision', AI_APPROVAL_DECISIONS);
  const decidedByRole = nullableString(row, 'decided_by_role');
  const decidedAt = nullableTimestamp(row, 'decided_at');
  const consumedAt = nullableTimestamp(row, 'consumed_at');
  const invalidationReasonCode = nullableString(row, 'invalidation_reason_code');
  if (
    ((decision === null) !== (decidedByRole === null))
    || ((decision === null) !== (decidedAt === null))
    || ((status === 'approved' || status === 'consumed') && decision !== 'approved')
    || (status === 'rejected' && decision !== 'rejected')
    || (status === 'pending' && decision !== null)
    || ((status === 'consumed') !== (consumedAt !== null))
    || ((status === 'invalidated') !== (invalidationReasonCode !== null))
  ) {
    throw new AiActivityReadError('invalid_projection', 'approval lifecycle is invalid');
  }
  return {
    approvalId: uuidValue(row, 'id'),
    taskId: uuidValue(row, 'task_id'),
    actionType: stringValue(row, 'action_type'),
    targetType: stringValue(row, 'target_type'),
    targetId: stringValue(row, 'target_id'),
    payloadHash: sha256Value(row, 'payload_hash'),
    payloadSummary: stringValue(row, 'payload_summary'),
    requiredRole: stringValue(row, 'required_role'),
    requestedByKind,
    requestedByKey: stringValue(row, 'requested_by_key'),
    requestedAt: timestamp(row, 'requested_at'),
    expiresAt: timestamp(row, 'expires_at'),
    singleUse: true,
    impact: stringArray(row, 'impact'),
    validations: validations.map(mapValidation),
    status,
    decision,
    decidedByRole,
    decidedAt,
    consumedAt,
    invalidationReasonCode,
  };
}

function throwIfDatabaseError(error: unknown): void {
  if (error) throw classifyDatabaseError(error);
}

export async function listAiActivityTasks(
  client: SupabaseClient,
  input: { status: AiTaskStatus | null; limit: number },
): Promise<AiActivityTaskSummary[]> {
  let query = client
    .from('ai_tasks')
    .select(AI_TASK_SAFE_SELECT)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(input.limit);
  if (input.status) query = query.eq('status', input.status);
  const result = await query;
  throwIfDatabaseError(result.error);
  return (Array.isArray(result.data) ? result.data : []).map(mapAiActivityTask);
}

export async function getAiActivityTaskDetail(
  client: SupabaseClient,
  taskId: string,
): Promise<AiActivityTaskDetail | null> {
  const taskResult = await client
    .from('ai_tasks')
    .select(AI_TASK_SAFE_SELECT)
    .eq('id', taskId)
    .maybeSingle();
  throwIfDatabaseError(taskResult.error);
  if (!taskResult.data) return null;

  const [eventResult, approvalResult] = await Promise.all([
    client
      .from('ai_task_events')
      .select(AI_TASK_EVENT_SAFE_SELECT)
      .eq('task_id', taskId)
      .order('sequence', { ascending: true }),
    client
      .from('ai_approvals')
      .select(AI_APPROVAL_SAFE_SELECT)
      .eq('task_id', taskId)
      .order('requested_at', { ascending: false }),
  ]);
  throwIfDatabaseError(eventResult.error);
  throwIfDatabaseError(approvalResult.error);

  return {
    task: mapAiActivityTask(taskResult.data),
    events: (Array.isArray(eventResult.data) ? eventResult.data : []).map(mapAiActivityEvent),
    approvals: (Array.isArray(approvalResult.data) ? approvalResult.data : []).map(mapAiActivityApproval),
  };
}
