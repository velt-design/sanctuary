import type { BackgroundJobJsonObject } from './workerContracts';

export const AI_SYNTHETIC_FIXTURE_KEYS = ['echo_v1', 'classification_v1'] as const;
export type AiSyntheticFixtureKey = (typeof AI_SYNTHETIC_FIXTURE_KEYS)[number];

export type AiSyntheticJobPayloadV1 = Readonly<{
  contractVersion: 1;
  taskId: string;
  inputSnapshotHash: string;
  fixtureKey: AiSyntheticFixtureKey;
}>;

export type AiSyntheticJobResultV1 = Readonly<{
  resultCode: 'SYNTHETIC_OK' | 'SYNTHETIC_ONLY';
  processedCount: 1;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === keys.length && actualKeys.every((key, index) => key === [...keys].sort()[index]);
}

export function parseAiSyntheticJobPayloadV1(payload: BackgroundJobJsonObject): AiSyntheticJobPayloadV1 {
  if (!isExactRecord(payload, ['contractVersion', 'fixtureKey', 'inputSnapshotHash', 'taskId'])) {
    throw new TypeError('Invalid AI synthetic payload shape');
  }
  if (payload.contractVersion !== 1) throw new TypeError('Invalid AI synthetic contract version');
  if (typeof payload.taskId !== 'string' || !UUID_PATTERN.test(payload.taskId)) {
    throw new TypeError('Invalid AI synthetic task ID');
  }
  if (typeof payload.inputSnapshotHash !== 'string' || !SHA256_PATTERN.test(payload.inputSnapshotHash)) {
    throw new TypeError('Invalid AI synthetic input snapshot hash');
  }
  if (
    typeof payload.fixtureKey !== 'string'
    || !(AI_SYNTHETIC_FIXTURE_KEYS as readonly string[]).includes(payload.fixtureKey)
  ) {
    throw new TypeError('Invalid AI synthetic fixture key');
  }
  return payload as AiSyntheticJobPayloadV1;
}

export function executeAiSyntheticFixture(payload: AiSyntheticJobPayloadV1): AiSyntheticJobResultV1 {
  return payload.fixtureKey === 'echo_v1'
    ? { resultCode: 'SYNTHETIC_OK', processedCount: 1 }
    : { resultCode: 'SYNTHETIC_ONLY', processedCount: 1 };
}
