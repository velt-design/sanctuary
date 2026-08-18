import type {
  AiApprovalDecision,
  AiApprovalStatus,
  AiDataClassification,
  AiRiskClass,
  AiTaskEventType,
  AiTaskStatus,
} from '@sp/ai';

export const AI_ACTIVITY_DEFAULT_LIMIT = 25;
export const AI_ACTIVITY_MAX_LIMIT = 50;

export type AiActivityTaskSummary = Readonly<{
  taskId: string;
  taskType: string;
  agentKey: string;
  agentVersion: string;
  capabilityKey: string;
  capabilityVersion: string;
  policyVersion: string;
  objective: string;
  status: AiTaskStatus;
  riskClass: AiRiskClass;
  dataClassification: AiDataClassification;
  projectId: string | null;
  parentTaskId: string | null;
  maxCostCents: number;
  actualCostCents: number;
  failureCode: string | null;
  safeFailureSummary: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type AiActivityEvent = Readonly<{
  eventKey: string;
  taskId: string;
  sequence: number;
  eventType: AiTaskEventType;
  fromStatus: AiTaskStatus | null;
  toStatus: AiTaskStatus | null;
  actorKind: 'human' | 'service' | 'agent' | 'node';
  actorKey: string;
  nodeId: string | null;
  safeSummary: string | null;
  occurredAt: string;
}>;

export type AiActivityApprovalValidation = Readonly<{
  validationKey: string;
  passed: boolean;
  evidenceId: string | null;
}>;

export type AiActivityApproval = Readonly<{
  approvalId: string;
  taskId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  payloadHash: string;
  payloadSummary: string;
  requiredRole: string;
  requestedByKind: 'agent';
  requestedByKey: string;
  requestedAt: string;
  expiresAt: string;
  singleUse: true;
  impact: readonly string[];
  validations: readonly AiActivityApprovalValidation[];
  status: AiApprovalStatus;
  decision: AiApprovalDecision | null;
  decidedByRole: string | null;
  decidedAt: string | null;
  consumedAt: string | null;
  invalidationReasonCode: string | null;
}>;

export type AiActivityTaskDetail = Readonly<{
  task: AiActivityTaskSummary;
  events: readonly AiActivityEvent[];
  approvals: readonly AiActivityApproval[];
}>;
