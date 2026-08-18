import {
  AI_APPROVAL_MODES,
  AI_AUTONOMY_MODES,
  AI_CONTRACT_VERSION,
  AI_DATA_CLASSIFICATIONS,
  AI_EFFECT_CLASSES,
  AI_RISK_CLASSES,
  parseAiCapabilityRefV1,
  type AiApprovalMode,
  type AiAutonomyMode,
  type AiCapabilityRefV1,
  type AiDataClassification,
  type AiEffectClass,
  type AiRiskClass,
} from './common';
import {
  addAiIssue,
  createAiContractSchema,
  readAiArray,
  readAiBoolean,
  readAiContractVersion,
  readAiEnum,
  readAiInteger,
  readAiKey,
  readAiNullable,
  readAiRecord,
  readAiString,
  readAiTimestamp,
  readAiVersion,
  requireAiTimestampOrder,
  requireAiUniqueStrings,
  type AiContractParseIssue,
} from './schema';

export const AI_NODE_KINDS = ['private_control', 'private_compute', 'hosted_worker'] as const;
export type AiNodeKind = (typeof AI_NODE_KINDS)[number];

export const AI_NODE_LOCALITIES = ['private_network', 'hosted'] as const;
export type AiNodeLocality = (typeof AI_NODE_LOCALITIES)[number];

export const AI_NODE_STATES = [
  'dark',
  'ready',
  'draining',
  'maintenance',
  'offline',
  'revoked',
] as const;
export type AiNodeState = (typeof AI_NODE_STATES)[number];

export const AI_CAPABILITY_ROLLOUT_MODES = ['dark', 'synthetic', 'active'] as const;
export type AiCapabilityRolloutMode = (typeof AI_CAPABILITY_ROLLOUT_MODES)[number];

export type AiCapabilityV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  capabilityKey: string;
  capabilityVersion: string;
  description: string;
  riskClass: AiRiskClass;
  maximumDataClassification: AiDataClassification;
  effectClass: AiEffectClass;
  approvalMode: AiApprovalMode;
  rolloutMode: AiCapabilityRolloutMode;
  allowedNodeKinds: readonly AiNodeKind[];
  requiredToolKeys: readonly string[];
  maxSteps: number;
  maxRuntimeSeconds: number;
  maxCostCents: number;
}>;

export type AiAgentV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  agentKey: string;
  agentVersion: string;
  displayName: string;
  autonomyMode: AiAutonomyMode;
  capabilities: readonly AiCapabilityRefV1[];
  allowedDataClassifications: readonly AiDataClassification[];
  toolAllowlist: readonly string[];
  maximumTaskCostCents: number;
  enabled: boolean;
}>;

export type AiNodeCapabilityV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  nodeId: string;
  nodeKind: AiNodeKind;
  locality: AiNodeLocality;
  state: AiNodeState;
  buildVersion: string;
  supportedCapabilities: readonly AiCapabilityRefV1[];
  allowedDataClassifications: readonly AiDataClassification[];
  concurrencyLimit: number;
  memoryMb: number | null;
  gpuMemoryMb: number | null;
  registeredAt: string;
  updatedAt: string;
  lastHeartbeatAt: string | null;
}>;

function parseAiKeyItem(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  return readAiKey(value, path, issues);
}

function parseAiDataClassification(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiDataClassification {
  return readAiEnum(value, AI_DATA_CLASSIFICATIONS, path, issues);
}

function capabilityIdentity(ref: AiCapabilityRefV1): string {
  return `${ref.capabilityKey}@${ref.capabilityVersion}`;
}

function requireUniqueCapabilities(
  refs: readonly AiCapabilityRefV1[],
  path: string,
  issues: AiContractParseIssue[],
): void {
  requireAiUniqueStrings(refs.map(capabilityIdentity), path, issues);
}

function parseAiCapabilityV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiCapabilityV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'capabilityKey',
    'capabilityVersion',
    'description',
    'riskClass',
    'maximumDataClassification',
    'effectClass',
    'approvalMode',
    'rolloutMode',
    'allowedNodeKinds',
    'requiredToolKeys',
    'maxSteps',
    'maxRuntimeSeconds',
    'maxCostCents',
  ], issues);
  const effectClass = readAiEnum(
    record.effectClass,
    AI_EFFECT_CLASSES,
    `${path}.effectClass`,
    issues,
  );
  const approvalMode = readAiEnum(
    record.approvalMode,
    AI_APPROVAL_MODES,
    `${path}.approvalMode`,
    issues,
  );
  const allowedNodeKinds = readAiArray(
    record.allowedNodeKinds,
    `${path}.allowedNodeKinds`,
    issues,
    (entry, entryPath, entryIssues) => readAiEnum(entry, AI_NODE_KINDS, entryPath, entryIssues),
    { minimum: 1, maximum: AI_NODE_KINDS.length },
  );
  const requiredToolKeys = readAiArray(
    record.requiredToolKeys,
    `${path}.requiredToolKeys`,
    issues,
    parseAiKeyItem,
    { maximum: 50 },
  );

  requireAiUniqueStrings(allowedNodeKinds, `${path}.allowedNodeKinds`, issues);
  requireAiUniqueStrings(requiredToolKeys, `${path}.requiredToolKeys`, issues);
  if (
    (effectClass === 'consequential' || effectClass === 'irreversible')
    && approvalMode !== 'before_effect'
  ) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.approvalMode`,
      'Consequential and irreversible capabilities require before_effect approval.',
    );
  }

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    capabilityKey: readAiKey(record.capabilityKey, `${path}.capabilityKey`, issues),
    capabilityVersion: readAiVersion(
      record.capabilityVersion,
      `${path}.capabilityVersion`,
      issues,
    ),
    description: readAiString(record.description, `${path}.description`, issues, { maximum: 500 }),
    riskClass: readAiEnum(record.riskClass, AI_RISK_CLASSES, `${path}.riskClass`, issues),
    maximumDataClassification: readAiEnum(
      record.maximumDataClassification,
      AI_DATA_CLASSIFICATIONS,
      `${path}.maximumDataClassification`,
      issues,
    ),
    effectClass,
    approvalMode,
    rolloutMode: readAiEnum(
      record.rolloutMode,
      AI_CAPABILITY_ROLLOUT_MODES,
      `${path}.rolloutMode`,
      issues,
    ),
    allowedNodeKinds,
    requiredToolKeys,
    maxSteps: readAiInteger(record.maxSteps, `${path}.maxSteps`, issues, {
      minimum: 1,
      maximum: 10_000,
    }),
    maxRuntimeSeconds: readAiInteger(
      record.maxRuntimeSeconds,
      `${path}.maxRuntimeSeconds`,
      issues,
      { minimum: 1, maximum: 604_800 },
    ),
    maxCostCents: readAiInteger(record.maxCostCents, `${path}.maxCostCents`, issues, {
      minimum: 0,
      maximum: 10_000_000,
    }),
  };
}

function parseAiAgentV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiAgentV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'agentKey',
    'agentVersion',
    'displayName',
    'autonomyMode',
    'capabilities',
    'allowedDataClassifications',
    'toolAllowlist',
    'maximumTaskCostCents',
    'enabled',
  ], issues);
  const capabilities = readAiArray(
    record.capabilities,
    `${path}.capabilities`,
    issues,
    parseAiCapabilityRefV1,
    { minimum: 1, maximum: 50 },
  );
  const allowedDataClassifications = readAiArray(
    record.allowedDataClassifications,
    `${path}.allowedDataClassifications`,
    issues,
    parseAiDataClassification,
    { minimum: 1, maximum: AI_DATA_CLASSIFICATIONS.length },
  );
  const toolAllowlist = readAiArray(
    record.toolAllowlist,
    `${path}.toolAllowlist`,
    issues,
    parseAiKeyItem,
    { maximum: 100 },
  );
  requireUniqueCapabilities(capabilities, `${path}.capabilities`, issues);
  requireAiUniqueStrings(
    allowedDataClassifications,
    `${path}.allowedDataClassifications`,
    issues,
  );
  requireAiUniqueStrings(toolAllowlist, `${path}.toolAllowlist`, issues);

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    agentKey: readAiKey(record.agentKey, `${path}.agentKey`, issues),
    agentVersion: readAiVersion(record.agentVersion, `${path}.agentVersion`, issues),
    displayName: readAiString(record.displayName, `${path}.displayName`, issues, { maximum: 120 }),
    autonomyMode: readAiEnum(
      record.autonomyMode,
      AI_AUTONOMY_MODES,
      `${path}.autonomyMode`,
      issues,
    ),
    capabilities,
    allowedDataClassifications,
    toolAllowlist,
    maximumTaskCostCents: readAiInteger(
      record.maximumTaskCostCents,
      `${path}.maximumTaskCostCents`,
      issues,
      { minimum: 0, maximum: 10_000_000 },
    ),
    enabled: readAiBoolean(record.enabled, `${path}.enabled`, issues),
  };
}

function parseAiNodeCapabilityV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiNodeCapabilityV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'nodeId',
    'nodeKind',
    'locality',
    'state',
    'buildVersion',
    'supportedCapabilities',
    'allowedDataClassifications',
    'concurrencyLimit',
    'memoryMb',
    'gpuMemoryMb',
    'registeredAt',
    'updatedAt',
    'lastHeartbeatAt',
  ], issues);
  const state = readAiEnum(record.state, AI_NODE_STATES, `${path}.state`, issues);
  const locality = readAiEnum(record.locality, AI_NODE_LOCALITIES, `${path}.locality`, issues);
  const nodeKind = readAiEnum(record.nodeKind, AI_NODE_KINDS, `${path}.nodeKind`, issues);
  const supportedCapabilities = readAiArray(
    record.supportedCapabilities,
    `${path}.supportedCapabilities`,
    issues,
    parseAiCapabilityRefV1,
    { maximum: 100 },
  );
  const allowedDataClassifications = readAiArray(
    record.allowedDataClassifications,
    `${path}.allowedDataClassifications`,
    issues,
    parseAiDataClassification,
    { minimum: 1, maximum: AI_DATA_CLASSIFICATIONS.length },
  );
  const registeredAt = readAiTimestamp(record.registeredAt, `${path}.registeredAt`, issues);
  const updatedAt = readAiTimestamp(record.updatedAt, `${path}.updatedAt`, issues);
  const lastHeartbeatAt = readAiNullable(
    record.lastHeartbeatAt,
    `${path}.lastHeartbeatAt`,
    issues,
    readAiTimestamp,
  );
  requireUniqueCapabilities(supportedCapabilities, `${path}.supportedCapabilities`, issues);
  requireAiUniqueStrings(
    allowedDataClassifications,
    `${path}.allowedDataClassifications`,
    issues,
  );
  requireAiTimestampOrder(registeredAt, updatedAt, `${path}.updatedAt`, issues);
  requireAiTimestampOrder(registeredAt, lastHeartbeatAt, `${path}.lastHeartbeatAt`, issues);
  if ((state === 'ready' || state === 'draining') && lastHeartbeatAt === null) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.lastHeartbeatAt`,
      `${state} nodes require a heartbeat.`,
    );
  }
  if (nodeKind === 'hosted_worker' && locality !== 'hosted') {
    addAiIssue(issues, 'invariant', `${path}.locality`, 'Hosted workers require hosted locality.');
  }
  if (nodeKind !== 'hosted_worker' && locality !== 'private_network') {
    addAiIssue(issues, 'invariant', `${path}.locality`, 'Private nodes require private_network locality.');
  }

  const parseNullableResource = (entry: unknown, entryPath: string, entryIssues: AiContractParseIssue[]) => (
    readAiInteger(entry, entryPath, entryIssues, { minimum: 1, maximum: 10_000_000 })
  );

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    nodeId: readAiKey(record.nodeId, `${path}.nodeId`, issues),
    nodeKind,
    locality,
    state,
    buildVersion: readAiVersion(record.buildVersion, `${path}.buildVersion`, issues),
    supportedCapabilities,
    allowedDataClassifications,
    concurrencyLimit: readAiInteger(
      record.concurrencyLimit,
      `${path}.concurrencyLimit`,
      issues,
      { minimum: 0, maximum: 10_000 },
    ),
    memoryMb: readAiNullable(record.memoryMb, `${path}.memoryMb`, issues, parseNullableResource),
    gpuMemoryMb: readAiNullable(
      record.gpuMemoryMb,
      `${path}.gpuMemoryMb`,
      issues,
      parseNullableResource,
    ),
    registeredAt,
    updatedAt,
    lastHeartbeatAt,
  };
}

export const AI_CAPABILITY_SCHEMA_V1 = createAiContractSchema(parseAiCapabilityV1);
export const AI_AGENT_SCHEMA_V1 = createAiContractSchema(parseAiAgentV1);
export const AI_NODE_CAPABILITY_SCHEMA_V1 = createAiContractSchema(parseAiNodeCapabilityV1);
