import {
  AI_CONTRACT_VERSION,
  AI_DATA_CLASSIFICATIONS,
  AI_RISK_CLASSES,
  parseAiActorRefV1,
  parseAiAgentRefV1,
  parseAiCapabilityRefV1,
  type AiActorRefV1,
  type AiAgentRefV1,
  type AiCapabilityRefV1,
  type AiDataClassification,
  type AiRiskClass,
} from './common';
import {
  addAiIssue,
  createAiContractSchema,
  readAiContractVersion,
  readAiEnum,
  readAiInteger,
  readAiKey,
  readAiNullable,
  readAiRecord,
  readAiSha256,
  readAiString,
  readAiTimestamp,
  readAiUuid,
  readAiVersion,
  requireAiTimestampOrder,
  type AiContractParseIssue,
} from './schema';

export const AI_TASK_STATUSES = [
  'proposed',
  'approved',
  'queued',
  'running',
  'awaiting_approval',
  'rejected',
  'succeeded',
  'failed',
  'needs_attention',
  'cancelled',
  'evaluated',
] as const;
export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];

export const AI_TASK_EVENT_TYPES = [
  'created',
  'status_changed',
  'assignment_changed',
  'policy_decision',
  'approval_requested',
  'approval_decided',
  'tool_summary',
  'retry_scheduled',
  'result_recorded',
  'evaluation_recorded',
] as const;
export type AiTaskEventType = (typeof AI_TASK_EVENT_TYPES)[number];

export type AiTaskV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  taskId: string;
  taskType: string;
  agent: AiAgentRefV1;
  capability: AiCapabilityRefV1;
  policyVersion: string;
  objective: string;
  status: AiTaskStatus;
  riskClass: AiRiskClass;
  dataClassification: AiDataClassification;
  requestedBy: AiActorRefV1;
  projectId: string | null;
  parentTaskId: string | null;
  idempotencyKey: string;
  inputSnapshotHash: string;
  maxCostCents: number;
  actualCostCents: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  safeFailureSummary: string | null;
}>;

export type AiTaskEventV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  eventId: string;
  taskId: string;
  sequence: number;
  eventType: AiTaskEventType;
  fromStatus: AiTaskStatus | null;
  toStatus: AiTaskStatus | null;
  actor: AiActorRefV1;
  nodeId: string | null;
  safeSummary: string | null;
  occurredAt: string;
}>;

function parseAiTaskV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiTaskV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'taskId',
    'taskType',
    'agent',
    'capability',
    'policyVersion',
    'objective',
    'status',
    'riskClass',
    'dataClassification',
    'requestedBy',
    'projectId',
    'parentTaskId',
    'idempotencyKey',
    'inputSnapshotHash',
    'maxCostCents',
    'actualCostCents',
    'createdAt',
    'updatedAt',
    'startedAt',
    'completedAt',
    'failureCode',
    'safeFailureSummary',
  ], issues);

  const taskId = readAiUuid(record.taskId, `${path}.taskId`, issues);
  const parentTaskId = readAiNullable(
    record.parentTaskId,
    `${path}.parentTaskId`,
    issues,
    readAiUuid,
  );
  const createdAt = readAiTimestamp(record.createdAt, `${path}.createdAt`, issues);
  const updatedAt = readAiTimestamp(record.updatedAt, `${path}.updatedAt`, issues);
  const startedAt = readAiNullable(record.startedAt, `${path}.startedAt`, issues, readAiTimestamp);
  const completedAt = readAiNullable(
    record.completedAt,
    `${path}.completedAt`,
    issues,
    readAiTimestamp,
  );

  if (parentTaskId === taskId && taskId) {
    addAiIssue(issues, 'invariant', `${path}.parentTaskId`, 'A task cannot parent itself.');
  }
  requireAiTimestampOrder(createdAt, updatedAt, `${path}.updatedAt`, issues);
  requireAiTimestampOrder(createdAt, startedAt, `${path}.startedAt`, issues);
  requireAiTimestampOrder(startedAt ?? createdAt, completedAt, `${path}.completedAt`, issues);

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    taskId,
    taskType: readAiKey(record.taskType, `${path}.taskType`, issues),
    agent: parseAiAgentRefV1(record.agent, `${path}.agent`, issues),
    capability: parseAiCapabilityRefV1(record.capability, `${path}.capability`, issues),
    policyVersion: readAiVersion(record.policyVersion, `${path}.policyVersion`, issues),
    objective: readAiString(record.objective, `${path}.objective`, issues, { maximum: 2_000 }),
    status: readAiEnum(record.status, AI_TASK_STATUSES, `${path}.status`, issues),
    riskClass: readAiEnum(record.riskClass, AI_RISK_CLASSES, `${path}.riskClass`, issues),
    dataClassification: readAiEnum(
      record.dataClassification,
      AI_DATA_CLASSIFICATIONS,
      `${path}.dataClassification`,
      issues,
    ),
    requestedBy: parseAiActorRefV1(record.requestedBy, `${path}.requestedBy`, issues),
    projectId: readAiNullable(record.projectId, `${path}.projectId`, issues, readAiUuid),
    parentTaskId,
    idempotencyKey: readAiKey(record.idempotencyKey, `${path}.idempotencyKey`, issues),
    inputSnapshotHash: readAiSha256(
      record.inputSnapshotHash,
      `${path}.inputSnapshotHash`,
      issues,
    ),
    maxCostCents: readAiInteger(record.maxCostCents, `${path}.maxCostCents`, issues, {
      minimum: 0,
      maximum: 10_000_000,
    }),
    actualCostCents: readAiInteger(record.actualCostCents, `${path}.actualCostCents`, issues, {
      minimum: 0,
      maximum: 10_000_000,
    }),
    createdAt,
    updatedAt,
    startedAt,
    completedAt,
    failureCode: readAiNullable(record.failureCode, `${path}.failureCode`, issues, readAiKey),
    safeFailureSummary: readAiNullable(
      record.safeFailureSummary,
      `${path}.safeFailureSummary`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, { maximum: 500 }),
    ),
  };
}

function parseAiTaskEventV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiTaskEventV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'eventId',
    'taskId',
    'sequence',
    'eventType',
    'fromStatus',
    'toStatus',
    'actor',
    'nodeId',
    'safeSummary',
    'occurredAt',
  ], issues);
  const eventType = readAiEnum(record.eventType, AI_TASK_EVENT_TYPES, `${path}.eventType`, issues);
  const fromStatus = readAiNullable(
    record.fromStatus,
    `${path}.fromStatus`,
    issues,
    (entry, entryPath, entryIssues) => readAiEnum(entry, AI_TASK_STATUSES, entryPath, entryIssues),
  );
  const toStatus = readAiNullable(
    record.toStatus,
    `${path}.toStatus`,
    issues,
    (entry, entryPath, entryIssues) => readAiEnum(entry, AI_TASK_STATUSES, entryPath, entryIssues),
  );
  if (eventType === 'status_changed' && toStatus === null) {
    addAiIssue(issues, 'invariant', `${path}.toStatus`, 'A status change requires a target status.');
  }
  if (eventType !== 'status_changed' && (fromStatus !== null || toStatus !== null)) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.eventType`,
      'Only status_changed events may include task statuses.',
    );
  }

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    eventId: readAiUuid(record.eventId, `${path}.eventId`, issues),
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    sequence: readAiInteger(record.sequence, `${path}.sequence`, issues, { minimum: 1 }),
    eventType,
    fromStatus,
    toStatus,
    actor: parseAiActorRefV1(record.actor, `${path}.actor`, issues),
    nodeId: readAiNullable(record.nodeId, `${path}.nodeId`, issues, readAiKey),
    safeSummary: readAiNullable(
      record.safeSummary,
      `${path}.safeSummary`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, { maximum: 500 }),
    ),
    occurredAt: readAiTimestamp(record.occurredAt, `${path}.occurredAt`, issues),
  };
}

export const AI_TASK_SCHEMA_V1 = createAiContractSchema(parseAiTaskV1);
export const AI_TASK_EVENT_SCHEMA_V1 = createAiContractSchema(parseAiTaskEventV1);
