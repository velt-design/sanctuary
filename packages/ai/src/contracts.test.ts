// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_AGENT_SCHEMA_V1,
  AI_APPROVAL_SCHEMA_V1,
  AI_ARTIFACT_SCHEMA_V1,
  AI_CAPABILITY_SCHEMA_V1,
  AI_EVALUATION_SCHEMA_V1,
  AI_EVIDENCE_SCHEMA_V1,
  AI_NODE_CAPABILITY_SCHEMA_V1,
  AI_SOURCE_SCHEMA_V1,
  AI_TASK_EVENT_SCHEMA_V1,
  AI_TASK_SCHEMA_V1,
  AI_USAGE_SCHEMA_V1,
  AiContractParseError,
  type AiContractParseResult,
} from './index';

const TASK_ID = '8b50378a-70c5-4c63-a47d-f31f27ed30ee';
const PROJECT_ID = '94c0a815-1f59-4e69-af1f-d6be0f3ca5b0';
const SOURCE_ID = '3e1a3866-5eb7-48b7-9bcb-4070cc6d75c4';
const EVIDENCE_ID = '20e69ded-f1da-4a20-8d45-4717fdcb21f0';
const ARTIFACT_ID = '48f2ed2b-49bc-4618-910f-f4219023603a';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const NOW = '2026-08-18T01:00:00.000Z';
const LATER = '2026-08-18T01:05:00.000Z';

const actor = { kind: 'human', actorKey: 'staff.jordan' };
const agent = { agentKey: 'sanctuary.synthetic', agentVersion: '1.0.0' };
const capability = { capabilityKey: 'synthetic.echo', capabilityVersion: '1.0.0' };

const fixtures = {
  task: {
    contractVersion: 1,
    taskId: TASK_ID,
    taskType: 'synthetic.echo',
    agent,
    capability,
    policyVersion: '1.0.0',
    objective: 'Return a deterministic synthetic result.',
    status: 'proposed',
    riskClass: 'low',
    dataClassification: 'internal',
    requestedBy: actor,
    projectId: PROJECT_ID,
    parentTaskId: null,
    idempotencyKey: 'synthetic.echo.fixture-1',
    inputSnapshotHash: HASH_A,
    maxCostCents: 10,
    actualCostCents: 0,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: null,
    completedAt: null,
    failureCode: null,
    safeFailureSummary: null,
  },
  event: {
    contractVersion: 1,
    eventId: '4b9de597-570d-45c8-b2f6-87c67a8cc4e9',
    taskId: TASK_ID,
    sequence: 2,
    eventType: 'status_changed',
    fromStatus: 'proposed',
    toStatus: 'approved',
    actor,
    nodeId: null,
    safeSummary: 'Synthetic scope approved.',
    occurredAt: LATER,
  },
  capability: {
    contractVersion: 1,
    capabilityKey: 'synthetic.echo',
    capabilityVersion: '1.0.0',
    description: 'Produces a deterministic synthetic result without an external effect.',
    riskClass: 'low',
    maximumDataClassification: 'internal',
    effectClass: 'none',
    approvalMode: 'none',
    rolloutMode: 'synthetic',
    allowedNodeKinds: ['private_control'],
    requiredToolKeys: [],
    maxSteps: 3,
    maxRuntimeSeconds: 30,
    maxCostCents: 10,
  },
  agent: {
    contractVersion: 1,
    agentKey: 'sanctuary.synthetic',
    agentVersion: '1.0.0',
    displayName: 'Sanctuary Synthetic Agent',
    autonomyMode: 'shadow',
    capabilities: [capability],
    allowedDataClassifications: ['public', 'internal'],
    toolAllowlist: [],
    maximumTaskCostCents: 10,
    enabled: true,
  },
  node: {
    contractVersion: 1,
    nodeId: 'mac-mini-primary',
    nodeKind: 'private_control',
    locality: 'private_network',
    state: 'dark',
    buildVersion: '1.0.0',
    supportedCapabilities: [capability],
    allowedDataClassifications: ['public', 'internal'],
    concurrencyLimit: 0,
    memoryMb: 49_152,
    gpuMemoryMb: null,
    registeredAt: NOW,
    updatedAt: NOW,
    lastHeartbeatAt: null,
  },
  approval: {
    contractVersion: 1,
    approvalId: '88e37aa7-b4c3-4092-a3ce-8ba754bb8e0e',
    taskId: TASK_ID,
    actionType: 'synthetic.effect',
    targetType: 'synthetic.fixture',
    targetId: 'fixture-1',
    payloadHash: HASH_B,
    payloadSummary: 'Record one synthetic effect receipt.',
    requiredRole: 'admin',
    requestedBy: { kind: 'agent', actorKey: 'sanctuary.synthetic' },
    requestedAt: NOW,
    expiresAt: LATER,
    singleUse: true,
    impact: ['Creates a synthetic audit record only.'],
    validations: [{ validationKey: 'synthetic.only', passed: true, evidenceId: null }],
    status: 'pending',
    decision: null,
    decidedBy: null,
    decidedAt: null,
    consumedAt: null,
    invalidationReasonCode: null,
  },
  source: {
    contractVersion: 1,
    sourceId: SOURCE_ID,
    sourceType: 'repository.document',
    sourceSystem: 'github',
    sourceRef: 'docs/ai/00-vision.md',
    sourceVersion: 'da7d99be',
    contentHash: HASH_A,
    ownerKey: 'sanctuary.platform',
    classification: 'internal',
    authority: 'authoritative',
    registeredAt: NOW,
    effectiveAt: NOW,
    expiresAt: null,
  },
  evidence: {
    contractVersion: 1,
    evidenceId: EVIDENCE_ID,
    taskId: TASK_ID,
    claimKey: 'synthetic.contract.valid',
    relation: 'supports',
    sourceId: SOURCE_ID,
    locator: 'AI-ADR-006',
    excerptHash: HASH_B,
    confidence: 1,
    retrievedAt: NOW,
  },
  artifact: {
    contractVersion: 1,
    artifactId: ARTIFACT_ID,
    taskId: TASK_ID,
    projectId: null,
    artifactType: 'synthetic.result',
    storageRef: 'ai-artifacts/synthetic/result.json',
    contentHash: HASH_B,
    classification: 'internal',
    status: 'staged',
    sourceIds: [SOURCE_ID],
    derivedFromArtifactIds: [],
    retentionClass: 'synthetic.short',
    createdAt: LATER,
  },
  usage: {
    contractVersion: 1,
    usageId: '386136a2-502e-4807-a90d-fb09653f61a4',
    taskId: TASK_ID,
    stepKey: 'synthetic.execute',
    capability,
    routeKey: 'mock.deterministic',
    providerKey: 'mock',
    modelSnapshot: 'deterministic-v1',
    inputUnits: 10,
    outputUnits: 5,
    mediaUnits: 0,
    computeMilliseconds: 4,
    latencyMilliseconds: 5,
    costCents: 0,
    cacheStatus: 'not_used',
    safeProviderRequestId: null,
    recordedAt: LATER,
  },
  evaluation: {
    contractVersion: 1,
    evaluationId: '0cfc7a58-dad3-4e15-bd16-628133394bd4',
    taskId: TASK_ID,
    evaluatorType: 'deterministic',
    evaluator: { kind: 'service', actorKey: 'evaluation.runner' },
    evaluationSetKey: 'synthetic.contract',
    evaluationSetVersion: '1.0.0',
    scores: [{ metricKey: 'exact.match', value: 1, threshold: 1, direction: 'at_least', passed: true }],
    result: 'passed',
    safeFeedbackSummary: 'The deterministic result matched.',
    productionOutcomeCode: null,
    promotionRecommendation: 'hold',
    evidenceIds: [EVIDENCE_ID],
    evaluatedAt: LATER,
  },
} as const;

type AnySchema = {
  parse(value: unknown): unknown;
  safeParse(value: unknown): AiContractParseResult<unknown>;
};

describe('@sp/ai V1 contracts', () => {
  it.each([
    ['task', AI_TASK_SCHEMA_V1, fixtures.task],
    ['task event', AI_TASK_EVENT_SCHEMA_V1, fixtures.event],
    ['capability', AI_CAPABILITY_SCHEMA_V1, fixtures.capability],
    ['agent', AI_AGENT_SCHEMA_V1, fixtures.agent],
    ['node capability', AI_NODE_CAPABILITY_SCHEMA_V1, fixtures.node],
    ['approval', AI_APPROVAL_SCHEMA_V1, fixtures.approval],
    ['source', AI_SOURCE_SCHEMA_V1, fixtures.source],
    ['evidence', AI_EVIDENCE_SCHEMA_V1, fixtures.evidence],
    ['artifact', AI_ARTIFACT_SCHEMA_V1, fixtures.artifact],
    ['usage', AI_USAGE_SCHEMA_V1, fixtures.usage],
    ['evaluation', AI_EVALUATION_SCHEMA_V1, fixtures.evaluation],
  ] as const)('accepts the canonical %s fixture without changing its shape', (_name, schema, fixture) => {
    expect((schema as AnySchema).safeParse(fixture)).toEqual({ success: true, data: fixture });
  });

  it.each([
    ['unknown fields', () => ({ ...fixtures.task, rawPrompt: 'do not persist me' }), '$.rawPrompt'],
    ['future contract versions', () => ({ ...fixtures.task, contractVersion: 2 }), '$.contractVersion'],
    ['non-digest input identity', () => ({ ...fixtures.task, inputSnapshotHash: 'customer data' }), '$.inputSnapshotHash'],
    ['reversed timestamps', () => ({ ...fixtures.task, updatedAt: '2026-08-17T01:00:00.000Z' }), '$.updatedAt'],
    ['self-parenting', () => ({ ...fixtures.task, parentTaskId: TASK_ID }), '$.parentTaskId'],
  ])('rejects %s on task contracts', (_name, makeValue, expectedPath) => {
    const result = AI_TASK_SCHEMA_V1.safeParse(makeValue());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((entry) => entry.path)).toContain(expectedPath);
  });

  it('binds consequential capabilities to approval before effect', () => {
    const result = AI_CAPABILITY_SCHEMA_V1.safeParse({
      ...fixtures.capability,
      effectClass: 'consequential',
      approvalMode: 'none',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'invariant',
        path: '$.approvalMode',
      }));
    }
  });

  it('requires live node states to carry a heartbeat and match their locality', () => {
    const missingHeartbeat = AI_NODE_CAPABILITY_SCHEMA_V1.safeParse({
      ...fixtures.node,
      state: 'ready',
      concurrencyLimit: 1,
    });
    const wrongLocality = AI_NODE_CAPABILITY_SCHEMA_V1.safeParse({
      ...fixtures.node,
      locality: 'hosted',
    });

    expect(missingHeartbeat.success).toBe(false);
    expect(wrongLocality.success).toBe(false);
  });

  it('enforces immutable, single-use approval envelope state', () => {
    const replayable = AI_APPROVAL_SCHEMA_V1.safeParse({ ...fixtures.approval, singleUse: false });
    const undecidedApproval = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      status: 'approved',
    });
    const consumedWithoutReceipt = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      status: 'consumed',
      decidedBy: actor,
      decidedAt: NOW,
    });

    for (const result of [replayable, undecidedApproval, consumedWithoutReceipt]) {
      expect(result.success).toBe(false);
      if (!result.success) expect(result.issues.some((entry) => entry.code === 'invariant')).toBe(true);
    }
  });

  it('preserves an exact prior decision when approval later expires or is invalidated', () => {
    const approvedDecision = {
      decision: 'approved' as const,
      decidedBy: actor,
      decidedAt: NOW,
    };
    const approved = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      ...approvedDecision,
      status: 'approved',
    });
    const expired = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      ...approvedDecision,
      status: 'expired',
    });
    const invalidated = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      ...approvedDecision,
      status: 'invalidated',
      invalidationReasonCode: 'task_cancelled',
    });
    const erasedDecision = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      status: 'approved',
      decision: null,
      decidedBy: actor,
      decidedAt: NOW,
    });
    const rejectedThenInvalidated = AI_APPROVAL_SCHEMA_V1.safeParse({
      ...fixtures.approval,
      status: 'invalidated',
      decision: 'rejected',
      decidedBy: actor,
      decidedAt: NOW,
      invalidationReasonCode: 'task_cancelled',
    });

    expect(approved.success).toBe(true);
    expect(expired.success).toBe(true);
    expect(invalidated.success).toBe(true);
    expect(erasedDecision.success).toBe(false);
    expect(rejectedThenInvalidated.success).toBe(false);
  });

  it('checks evaluation threshold direction instead of trusting a claimed pass', () => {
    const result = AI_EVALUATION_SCHEMA_V1.safeParse({
      ...fixtures.evaluation,
      scores: [{
        metricKey: 'error.rate',
        value: 0.2,
        threshold: 0.1,
        direction: 'at_most',
        passed: true,
      }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.path).toBe('$.scores[0].passed');
  });

  it('rejects duplicate registry and lineage identities', () => {
    const agentResult = AI_AGENT_SCHEMA_V1.safeParse({
      ...fixtures.agent,
      capabilities: [capability, capability],
    });
    const artifactResult = AI_ARTIFACT_SCHEMA_V1.safeParse({
      ...fixtures.artifact,
      derivedFromArtifactIds: [ARTIFACT_ID],
    });
    expect(agentResult.success).toBe(false);
    expect(artifactResult.success).toBe(false);
  });

  it('throws one typed aggregate error from parse()', () => {
    expect(() => AI_TASK_SCHEMA_V1.parse({})).toThrow(AiContractParseError);
  });

  it('has no runtime dependency or app/provider SDK import', () => {
    const packageDir = path.join(process.cwd(), 'packages/ai');
    const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
    expect(packageJson.optionalDependencies).toBeUndefined();

    const sourceFiles = readdirSync(path.join(packageDir, 'src'))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(path.join(packageDir, 'src', sourceFile), 'utf8');
      const imports = [...source.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'\"]*?\s+from\s*)?['\"]([^'\"]+)['\"]/g)]
        .map((match) => match[1]);
      expect(imports.every((specifier) => specifier?.startsWith('.')), sourceFile).toBe(true);
    }
  });
});
