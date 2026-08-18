import {
  AI_CONTRACT_VERSION,
  AI_DATA_CLASSIFICATIONS,
  parseAiActorRefV1,
  type AiActorRefV1,
  type AiDataClassification,
} from './common';
import {
  addAiIssue,
  createAiContractSchema,
  readAiArray,
  readAiBoolean,
  readAiContractVersion,
  readAiEnum,
  readAiKey,
  readAiNullable,
  readAiNumber,
  readAiRecord,
  readAiSha256,
  readAiString,
  readAiTimestamp,
  readAiUuid,
  requireAiTimestampOrder,
  requireAiUniqueStrings,
  type AiContractParseIssue,
} from './schema';

export const AI_APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'consumed',
  'invalidated',
  'expired',
] as const;
export type AiApprovalStatus = (typeof AI_APPROVAL_STATUSES)[number];

export const AI_APPROVAL_DECISIONS = ['approved', 'rejected'] as const;
export type AiApprovalDecision = (typeof AI_APPROVAL_DECISIONS)[number];

export const AI_SOURCE_AUTHORITIES = [
  'authoritative',
  'reference',
  'derived',
  'unverified',
] as const;
export type AiSourceAuthority = (typeof AI_SOURCE_AUTHORITIES)[number];

export const AI_EVIDENCE_RELATIONS = ['supports', 'contradicts', 'context'] as const;
export type AiEvidenceRelation = (typeof AI_EVIDENCE_RELATIONS)[number];

export const AI_ARTIFACT_STATUSES = [
  'staged',
  'approved',
  'published',
  'quarantined',
  'retired',
] as const;
export type AiArtifactStatus = (typeof AI_ARTIFACT_STATUSES)[number];

export type AiApprovalValidationV1 = Readonly<{
  validationKey: string;
  passed: boolean;
  evidenceId: string | null;
}>;

export type AiApprovalV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  approvalId: string;
  taskId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  payloadHash: string;
  payloadSummary: string;
  requiredRole: string;
  requestedBy: AiActorRefV1;
  requestedAt: string;
  expiresAt: string;
  singleUse: true;
  impact: readonly string[];
  validations: readonly AiApprovalValidationV1[];
  status: AiApprovalStatus;
  decision: AiApprovalDecision | null;
  decidedBy: AiActorRefV1 | null;
  decidedAt: string | null;
  consumedAt: string | null;
  invalidationReasonCode: string | null;
}>;

export type AiSourceV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  sourceId: string;
  sourceType: string;
  sourceSystem: string;
  sourceRef: string;
  sourceVersion: string | null;
  contentHash: string | null;
  ownerKey: string;
  classification: AiDataClassification;
  authority: AiSourceAuthority;
  registeredAt: string;
  effectiveAt: string | null;
  expiresAt: string | null;
}>;

export type AiEvidenceV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  evidenceId: string;
  taskId: string;
  claimKey: string;
  relation: AiEvidenceRelation;
  sourceId: string;
  locator: string | null;
  excerptHash: string | null;
  confidence: number | null;
  retrievedAt: string;
}>;

export type AiArtifactV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  artifactId: string;
  taskId: string;
  projectId: string | null;
  artifactType: string;
  storageRef: string;
  contentHash: string;
  classification: AiDataClassification;
  status: AiArtifactStatus;
  sourceIds: readonly string[];
  derivedFromArtifactIds: readonly string[];
  retentionClass: string;
  createdAt: string;
}>;

function parseAiApprovalValidationV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiApprovalValidationV1 {
  const record = readAiRecord(value, path, ['validationKey', 'passed', 'evidenceId'], issues);
  return {
    validationKey: readAiKey(record.validationKey, `${path}.validationKey`, issues),
    passed: readAiBoolean(record.passed, `${path}.passed`, issues),
    evidenceId: readAiNullable(record.evidenceId, `${path}.evidenceId`, issues, readAiUuid),
  };
}

function parseImpactItem(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  return readAiString(value, path, issues, { maximum: 240 });
}

function parseUuidItem(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  return readAiUuid(value, path, issues);
}

function parseAiApprovalV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiApprovalV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'approvalId',
    'taskId',
    'actionType',
    'targetType',
    'targetId',
    'payloadHash',
    'payloadSummary',
    'requiredRole',
    'requestedBy',
    'requestedAt',
    'expiresAt',
    'singleUse',
    'impact',
    'validations',
    'status',
    'decision',
    'decidedBy',
    'decidedAt',
    'consumedAt',
    'invalidationReasonCode',
  ], issues);
  const requestedAt = readAiTimestamp(record.requestedAt, `${path}.requestedAt`, issues);
  const expiresAt = readAiTimestamp(record.expiresAt, `${path}.expiresAt`, issues);
  const singleUse = readAiBoolean(record.singleUse, `${path}.singleUse`, issues);
  const impact = readAiArray(record.impact, `${path}.impact`, issues, parseImpactItem, {
    minimum: 1,
    maximum: 20,
  });
  const validations = readAiArray(
    record.validations,
    `${path}.validations`,
    issues,
    parseAiApprovalValidationV1,
    { maximum: 50 },
  );
  const status = readAiEnum(record.status, AI_APPROVAL_STATUSES, `${path}.status`, issues);
  const decision = readAiNullable(
    record.decision,
    `${path}.decision`,
    issues,
    (value, decisionPath, decisionIssues) =>
      readAiEnum(value, AI_APPROVAL_DECISIONS, decisionPath, decisionIssues),
  );
  const decidedBy = readAiNullable(
    record.decidedBy,
    `${path}.decidedBy`,
    issues,
    parseAiActorRefV1,
  );
  const decidedAt = readAiNullable(record.decidedAt, `${path}.decidedAt`, issues, readAiTimestamp);
  const consumedAt = readAiNullable(record.consumedAt, `${path}.consumedAt`, issues, readAiTimestamp);
  const invalidationReasonCode = readAiNullable(
    record.invalidationReasonCode,
    `${path}.invalidationReasonCode`,
    issues,
    readAiKey,
  );

  if (!singleUse) {
    addAiIssue(issues, 'invariant', `${path}.singleUse`, 'Approval envelopes are single-use.');
  }
  requireAiTimestampOrder(requestedAt, expiresAt, `${path}.expiresAt`, issues);
  requireAiTimestampOrder(requestedAt, decidedAt, `${path}.decidedAt`, issues);
  requireAiTimestampOrder(decidedAt ?? requestedAt, consumedAt, `${path}.consumedAt`, issues);
  requireAiUniqueStrings(
    validations.map((entry) => entry.validationKey),
    `${path}.validations`,
    issues,
  );

  if (
    (decision === null) !== (decidedBy === null)
    || (decision === null) !== (decidedAt === null)
  ) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.decision`,
      'Approval decision, identity, and time must be recorded together.',
    );
  }

  if (
    (status === 'approved' || status === 'consumed')
    && decision !== 'approved'
  ) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.status`,
      `${status} approvals require an approved decision.`,
    );
  }
  if (status === 'rejected' && decision !== 'rejected') {
    addAiIssue(
      issues,
      'invariant',
      `${path}.status`,
      'Rejected approvals require a rejected decision.',
    );
  }
  if (status === 'pending' && decision !== null) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.decision`,
      'Pending approvals cannot include a decision.',
    );
  }
  if (
    (status === 'expired' || status === 'invalidated')
    && decision === 'rejected'
  ) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.decision`,
      `${status} approvals may preserve only a prior approved decision.`,
    );
  }
  if ((status === 'consumed') !== (consumedAt !== null)) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.consumedAt`,
      'Only consumed approvals require a consumption timestamp.',
    );
  }
  if ((status === 'invalidated') !== (invalidationReasonCode !== null)) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.invalidationReasonCode`,
      'Only invalidated approvals require an invalidation reason.',
    );
  }

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    approvalId: readAiUuid(record.approvalId, `${path}.approvalId`, issues),
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    actionType: readAiKey(record.actionType, `${path}.actionType`, issues),
    targetType: readAiKey(record.targetType, `${path}.targetType`, issues),
    targetId: readAiString(record.targetId, `${path}.targetId`, issues, { maximum: 160 }),
    payloadHash: readAiSha256(record.payloadHash, `${path}.payloadHash`, issues),
    payloadSummary: readAiString(record.payloadSummary, `${path}.payloadSummary`, issues, {
      maximum: 500,
    }),
    requiredRole: readAiKey(record.requiredRole, `${path}.requiredRole`, issues),
    requestedBy: parseAiActorRefV1(record.requestedBy, `${path}.requestedBy`, issues),
    requestedAt,
    expiresAt,
    singleUse: singleUse as true,
    impact,
    validations,
    status,
    decision,
    decidedBy,
    decidedAt,
    consumedAt,
    invalidationReasonCode,
  };
}

function parseAiSourceV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiSourceV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'sourceId',
    'sourceType',
    'sourceSystem',
    'sourceRef',
    'sourceVersion',
    'contentHash',
    'ownerKey',
    'classification',
    'authority',
    'registeredAt',
    'effectiveAt',
    'expiresAt',
  ], issues);
  const registeredAt = readAiTimestamp(record.registeredAt, `${path}.registeredAt`, issues);
  const effectiveAt = readAiNullable(
    record.effectiveAt,
    `${path}.effectiveAt`,
    issues,
    readAiTimestamp,
  );
  const expiresAt = readAiNullable(record.expiresAt, `${path}.expiresAt`, issues, readAiTimestamp);
  requireAiTimestampOrder(effectiveAt ?? registeredAt, expiresAt, `${path}.expiresAt`, issues);

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    sourceId: readAiUuid(record.sourceId, `${path}.sourceId`, issues),
    sourceType: readAiKey(record.sourceType, `${path}.sourceType`, issues),
    sourceSystem: readAiKey(record.sourceSystem, `${path}.sourceSystem`, issues),
    sourceRef: readAiString(record.sourceRef, `${path}.sourceRef`, issues, { maximum: 1_000 }),
    sourceVersion: readAiNullable(
      record.sourceVersion,
      `${path}.sourceVersion`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, { maximum: 120 }),
    ),
    contentHash: readAiNullable(record.contentHash, `${path}.contentHash`, issues, readAiSha256),
    ownerKey: readAiKey(record.ownerKey, `${path}.ownerKey`, issues),
    classification: readAiEnum(
      record.classification,
      AI_DATA_CLASSIFICATIONS,
      `${path}.classification`,
      issues,
    ),
    authority: readAiEnum(record.authority, AI_SOURCE_AUTHORITIES, `${path}.authority`, issues),
    registeredAt,
    effectiveAt,
    expiresAt,
  };
}

function parseAiEvidenceV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiEvidenceV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'evidenceId',
    'taskId',
    'claimKey',
    'relation',
    'sourceId',
    'locator',
    'excerptHash',
    'confidence',
    'retrievedAt',
  ], issues);
  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    evidenceId: readAiUuid(record.evidenceId, `${path}.evidenceId`, issues),
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    claimKey: readAiKey(record.claimKey, `${path}.claimKey`, issues),
    relation: readAiEnum(record.relation, AI_EVIDENCE_RELATIONS, `${path}.relation`, issues),
    sourceId: readAiUuid(record.sourceId, `${path}.sourceId`, issues),
    locator: readAiNullable(
      record.locator,
      `${path}.locator`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, { maximum: 500 }),
    ),
    excerptHash: readAiNullable(record.excerptHash, `${path}.excerptHash`, issues, readAiSha256),
    confidence: readAiNullable(
      record.confidence,
      `${path}.confidence`,
      issues,
      (entry, entryPath, entryIssues) => readAiNumber(entry, entryPath, entryIssues, {
        minimum: 0,
        maximum: 1,
      }),
    ),
    retrievedAt: readAiTimestamp(record.retrievedAt, `${path}.retrievedAt`, issues),
  };
}

function parseAiArtifactV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiArtifactV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'artifactId',
    'taskId',
    'projectId',
    'artifactType',
    'storageRef',
    'contentHash',
    'classification',
    'status',
    'sourceIds',
    'derivedFromArtifactIds',
    'retentionClass',
    'createdAt',
  ], issues);
  const artifactId = readAiUuid(record.artifactId, `${path}.artifactId`, issues);
  const sourceIds = readAiArray(record.sourceIds, `${path}.sourceIds`, issues, parseUuidItem, {
    maximum: 100,
  });
  const derivedFromArtifactIds = readAiArray(
    record.derivedFromArtifactIds,
    `${path}.derivedFromArtifactIds`,
    issues,
    parseUuidItem,
    { maximum: 100 },
  );
  requireAiUniqueStrings(sourceIds, `${path}.sourceIds`, issues);
  requireAiUniqueStrings(derivedFromArtifactIds, `${path}.derivedFromArtifactIds`, issues);
  if (derivedFromArtifactIds.includes(artifactId)) {
    addAiIssue(
      issues,
      'invariant',
      `${path}.derivedFromArtifactIds`,
      'An artifact cannot derive from itself.',
    );
  }

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    artifactId,
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    projectId: readAiNullable(record.projectId, `${path}.projectId`, issues, readAiUuid),
    artifactType: readAiKey(record.artifactType, `${path}.artifactType`, issues),
    storageRef: readAiString(record.storageRef, `${path}.storageRef`, issues, { maximum: 1_000 }),
    contentHash: readAiSha256(record.contentHash, `${path}.contentHash`, issues),
    classification: readAiEnum(
      record.classification,
      AI_DATA_CLASSIFICATIONS,
      `${path}.classification`,
      issues,
    ),
    status: readAiEnum(record.status, AI_ARTIFACT_STATUSES, `${path}.status`, issues),
    sourceIds,
    derivedFromArtifactIds,
    retentionClass: readAiKey(record.retentionClass, `${path}.retentionClass`, issues),
    createdAt: readAiTimestamp(record.createdAt, `${path}.createdAt`, issues),
  };
}

export const AI_APPROVAL_SCHEMA_V1 = createAiContractSchema(parseAiApprovalV1);
export const AI_SOURCE_SCHEMA_V1 = createAiContractSchema(parseAiSourceV1);
export const AI_EVIDENCE_SCHEMA_V1 = createAiContractSchema(parseAiEvidenceV1);
export const AI_ARTIFACT_SCHEMA_V1 = createAiContractSchema(parseAiArtifactV1);
