import {
  AI_CONTRACT_VERSION,
  parseAiActorRefV1,
  parseAiCapabilityRefV1,
  type AiActorRefV1,
  type AiCapabilityRefV1,
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
  readAiNumber,
  readAiRecord,
  readAiString,
  readAiTimestamp,
  readAiUuid,
  readAiVersion,
  requireAiUniqueStrings,
  type AiContractParseIssue,
} from './schema';

export const AI_USAGE_CACHE_STATUSES = ['not_used', 'hit', 'miss', 'write'] as const;
export type AiUsageCacheStatus = (typeof AI_USAGE_CACHE_STATUSES)[number];

export const AI_EVALUATOR_TYPES = ['deterministic', 'model', 'human', 'production_outcome'] as const;
export type AiEvaluatorType = (typeof AI_EVALUATOR_TYPES)[number];

export const AI_EVALUATION_RESULTS = ['passed', 'failed', 'manual_review'] as const;
export type AiEvaluationResult = (typeof AI_EVALUATION_RESULTS)[number];

export const AI_EVALUATION_DIRECTIONS = ['at_least', 'at_most'] as const;
export type AiEvaluationDirection = (typeof AI_EVALUATION_DIRECTIONS)[number];

export const AI_PROMOTION_RECOMMENDATIONS = [
  'hold',
  'promote',
  'demote',
  'not_applicable',
] as const;
export type AiPromotionRecommendation = (typeof AI_PROMOTION_RECOMMENDATIONS)[number];

export type AiUsageV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  usageId: string;
  taskId: string;
  stepKey: string;
  capability: AiCapabilityRefV1;
  routeKey: string;
  providerKey: string;
  modelSnapshot: string;
  inputUnits: number;
  outputUnits: number;
  mediaUnits: number;
  computeMilliseconds: number;
  latencyMilliseconds: number;
  costCents: number;
  cacheStatus: AiUsageCacheStatus;
  safeProviderRequestId: string | null;
  recordedAt: string;
}>;

export type AiEvaluationScoreV1 = Readonly<{
  metricKey: string;
  value: number;
  threshold: number | null;
  direction: AiEvaluationDirection;
  passed: boolean;
}>;

export type AiEvaluationV1 = Readonly<{
  contractVersion: typeof AI_CONTRACT_VERSION;
  evaluationId: string;
  taskId: string;
  evaluatorType: AiEvaluatorType;
  evaluator: AiActorRefV1;
  evaluationSetKey: string;
  evaluationSetVersion: string;
  scores: readonly AiEvaluationScoreV1[];
  result: AiEvaluationResult;
  safeFeedbackSummary: string | null;
  productionOutcomeCode: string | null;
  promotionRecommendation: AiPromotionRecommendation;
  evidenceIds: readonly string[];
  evaluatedAt: string;
}>;

function parseAiEvaluationScoreV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiEvaluationScoreV1 {
  const record = readAiRecord(
    value,
    path,
    ['metricKey', 'value', 'threshold', 'direction', 'passed'],
    issues,
  );
  const score = readAiNumber(record.value, `${path}.value`, issues, { minimum: 0, maximum: 1 });
  const threshold = readAiNullable(
    record.threshold,
    `${path}.threshold`,
    issues,
    (entry, entryPath, entryIssues) => readAiNumber(entry, entryPath, entryIssues, {
      minimum: 0,
      maximum: 1,
    }),
  );
  const direction = readAiEnum(
    record.direction,
    AI_EVALUATION_DIRECTIONS,
    `${path}.direction`,
    issues,
  );
  const passed = readAiBoolean(record.passed, `${path}.passed`, issues);
  if (threshold !== null) {
    const expected = direction === 'at_least' ? score >= threshold : score <= threshold;
    if (passed !== expected) {
      addAiIssue(
        issues,
        'invariant',
        `${path}.passed`,
        'Threshold result does not match value and direction.',
      );
    }
  }
  return {
    metricKey: readAiKey(record.metricKey, `${path}.metricKey`, issues),
    value: score,
    threshold,
    direction,
    passed,
  };
}

function parseUuidItem(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  return readAiUuid(value, path, issues);
}

function parseAiUsageV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiUsageV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'usageId',
    'taskId',
    'stepKey',
    'capability',
    'routeKey',
    'providerKey',
    'modelSnapshot',
    'inputUnits',
    'outputUnits',
    'mediaUnits',
    'computeMilliseconds',
    'latencyMilliseconds',
    'costCents',
    'cacheStatus',
    'safeProviderRequestId',
    'recordedAt',
  ], issues);
  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    usageId: readAiUuid(record.usageId, `${path}.usageId`, issues),
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    stepKey: readAiKey(record.stepKey, `${path}.stepKey`, issues),
    capability: parseAiCapabilityRefV1(record.capability, `${path}.capability`, issues),
    routeKey: readAiKey(record.routeKey, `${path}.routeKey`, issues),
    providerKey: readAiKey(record.providerKey, `${path}.providerKey`, issues),
    modelSnapshot: readAiString(record.modelSnapshot, `${path}.modelSnapshot`, issues, {
      maximum: 160,
    }),
    inputUnits: readAiInteger(record.inputUnits, `${path}.inputUnits`, issues, { minimum: 0 }),
    outputUnits: readAiInteger(record.outputUnits, `${path}.outputUnits`, issues, { minimum: 0 }),
    mediaUnits: readAiInteger(record.mediaUnits, `${path}.mediaUnits`, issues, { minimum: 0 }),
    computeMilliseconds: readAiInteger(
      record.computeMilliseconds,
      `${path}.computeMilliseconds`,
      issues,
      { minimum: 0 },
    ),
    latencyMilliseconds: readAiInteger(
      record.latencyMilliseconds,
      `${path}.latencyMilliseconds`,
      issues,
      { minimum: 0 },
    ),
    costCents: readAiNumber(record.costCents, `${path}.costCents`, issues, { minimum: 0 }),
    cacheStatus: readAiEnum(
      record.cacheStatus,
      AI_USAGE_CACHE_STATUSES,
      `${path}.cacheStatus`,
      issues,
    ),
    safeProviderRequestId: readAiNullable(
      record.safeProviderRequestId,
      `${path}.safeProviderRequestId`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, {
        maximum: 160,
      }),
    ),
    recordedAt: readAiTimestamp(record.recordedAt, `${path}.recordedAt`, issues),
  };
}

function parseAiEvaluationV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): AiEvaluationV1 {
  const record = readAiRecord(value, path, [
    'contractVersion',
    'evaluationId',
    'taskId',
    'evaluatorType',
    'evaluator',
    'evaluationSetKey',
    'evaluationSetVersion',
    'scores',
    'result',
    'safeFeedbackSummary',
    'productionOutcomeCode',
    'promotionRecommendation',
    'evidenceIds',
    'evaluatedAt',
  ], issues);
  const scores = readAiArray(
    record.scores,
    `${path}.scores`,
    issues,
    parseAiEvaluationScoreV1,
    { minimum: 1, maximum: 100 },
  );
  const evidenceIds = readAiArray(
    record.evidenceIds,
    `${path}.evidenceIds`,
    issues,
    parseUuidItem,
    { maximum: 100 },
  );
  requireAiUniqueStrings(scores.map((entry) => entry.metricKey), `${path}.scores`, issues);
  requireAiUniqueStrings(evidenceIds, `${path}.evidenceIds`, issues);

  return {
    contractVersion: readAiContractVersion(
      record.contractVersion,
      AI_CONTRACT_VERSION,
      `${path}.contractVersion`,
      issues,
    ) as typeof AI_CONTRACT_VERSION,
    evaluationId: readAiUuid(record.evaluationId, `${path}.evaluationId`, issues),
    taskId: readAiUuid(record.taskId, `${path}.taskId`, issues),
    evaluatorType: readAiEnum(
      record.evaluatorType,
      AI_EVALUATOR_TYPES,
      `${path}.evaluatorType`,
      issues,
    ),
    evaluator: parseAiActorRefV1(record.evaluator, `${path}.evaluator`, issues),
    evaluationSetKey: readAiKey(record.evaluationSetKey, `${path}.evaluationSetKey`, issues),
    evaluationSetVersion: readAiVersion(
      record.evaluationSetVersion,
      `${path}.evaluationSetVersion`,
      issues,
    ),
    scores,
    result: readAiEnum(record.result, AI_EVALUATION_RESULTS, `${path}.result`, issues),
    safeFeedbackSummary: readAiNullable(
      record.safeFeedbackSummary,
      `${path}.safeFeedbackSummary`,
      issues,
      (entry, entryPath, entryIssues) => readAiString(entry, entryPath, entryIssues, { maximum: 500 }),
    ),
    productionOutcomeCode: readAiNullable(
      record.productionOutcomeCode,
      `${path}.productionOutcomeCode`,
      issues,
      readAiKey,
    ),
    promotionRecommendation: readAiEnum(
      record.promotionRecommendation,
      AI_PROMOTION_RECOMMENDATIONS,
      `${path}.promotionRecommendation`,
      issues,
    ),
    evidenceIds,
    evaluatedAt: readAiTimestamp(record.evaluatedAt, `${path}.evaluatedAt`, issues),
  };
}

export const AI_USAGE_SCHEMA_V1 = createAiContractSchema(parseAiUsageV1);
export const AI_EVALUATION_SCHEMA_V1 = createAiContractSchema(parseAiEvaluationV1);
