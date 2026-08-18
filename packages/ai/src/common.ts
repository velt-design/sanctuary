import {
  readAiEnum,
  readAiKey,
  readAiRecord,
  readAiVersion,
  type AiContractParseIssue,
} from './schema';

export const AI_CONTRACT_VERSION = 1 as const;

export const AI_DATA_CLASSIFICATIONS = [
  'public',
  'internal',
  'confidential',
  'restricted',
] as const;
export type AiDataClassification = (typeof AI_DATA_CLASSIFICATIONS)[number];

export const AI_RISK_CLASSES = ['low', 'medium', 'high', 'critical'] as const;
export type AiRiskClass = (typeof AI_RISK_CLASSES)[number];

export const AI_ACTOR_KINDS = ['human', 'service', 'agent', 'node'] as const;
export type AiActorKind = (typeof AI_ACTOR_KINDS)[number];

export const AI_APPROVAL_MODES = [
  'none',
  'before_tool',
  'before_effect',
  'before_completion',
] as const;
export type AiApprovalMode = (typeof AI_APPROVAL_MODES)[number];

export const AI_AUTONOMY_MODES = [
  'shadow',
  'suggest',
  'draft',
  'approval_gated',
  'supervised',
  'audited',
] as const;
export type AiAutonomyMode = (typeof AI_AUTONOMY_MODES)[number];

export const AI_EFFECT_CLASSES = [
  'none',
  'read_only',
  'reversible_write',
  'consequential',
  'irreversible',
] as const;
export type AiEffectClass = (typeof AI_EFFECT_CLASSES)[number];

export type AiActorRefV1 = Readonly<{
  kind: AiActorKind;
  actorKey: string;
}>;

export type AiCapabilityRefV1 = Readonly<{
  capabilityKey: string;
  capabilityVersion: string;
}>;

export type AiAgentRefV1 = Readonly<{
  agentKey: string;
  agentVersion: string;
}>;

export function parseAiActorRefV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiActorRefV1 {
  const record = readAiRecord(value, path, ['kind', 'actorKey'], issues);
  return {
    kind: readAiEnum(record.kind, AI_ACTOR_KINDS, `${path}.kind`, issues),
    actorKey: readAiKey(record.actorKey, `${path}.actorKey`, issues),
  };
}

export function parseAiCapabilityRefV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiCapabilityRefV1 {
  const record = readAiRecord(
    value,
    path,
    ['capabilityKey', 'capabilityVersion'],
    issues,
  );
  return {
    capabilityKey: readAiKey(record.capabilityKey, `${path}.capabilityKey`, issues),
    capabilityVersion: readAiVersion(
      record.capabilityVersion,
      `${path}.capabilityVersion`,
      issues,
    ),
  };
}

export function parseAiAgentRefV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiAgentRefV1 {
  const record = readAiRecord(value, path, ['agentKey', 'agentVersion'], issues);
  return {
    agentKey: readAiKey(record.agentKey, `${path}.agentKey`, issues),
    agentVersion: readAiVersion(record.agentVersion, `${path}.agentVersion`, issues),
  };
}
