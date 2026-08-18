import { describe, expect, it } from 'vitest';

import {
  executeAiSyntheticFixture,
  parseAiSyntheticJobPayloadV1,
  type BackgroundJobJsonObject,
} from '@sp/jobs';

const validPayload = {
  contractVersion: 1,
  taskId: 'ff2c34be-b033-403d-9bb9-8486f6b3cbb8',
  inputSnapshotHash: `sha256:${'a'.repeat(64)}`,
  fixtureKey: 'echo_v1',
} as const satisfies BackgroundJobJsonObject;

describe('AI synthetic background-job contract', () => {
  it('parses the exact private payload and produces a deterministic echo result', () => {
    const parsed = parseAiSyntheticJobPayloadV1(validPayload);
    expect(executeAiSyntheticFixture(parsed)).toEqual({
      resultCode: 'SYNTHETIC_OK',
      processedCount: 1,
    });
    expect(executeAiSyntheticFixture(parsed)).toEqual(executeAiSyntheticFixture(parsed));
  });

  it('produces the fixed classification result without provider or model input', () => {
    const parsed = parseAiSyntheticJobPayloadV1({
      ...validPayload,
      fixtureKey: 'classification_v1',
    });
    expect(executeAiSyntheticFixture(parsed)).toEqual({
      resultCode: 'SYNTHETIC_ONLY',
      processedCount: 1,
    });
  });

  it.each([
    { ...validPayload, extra: 'not-allowed' },
    { ...validPayload, contractVersion: 2 },
    { ...validPayload, taskId: 'not-a-uuid' },
    { ...validPayload, inputSnapshotHash: 'sha256:changed' },
    { ...validPayload, fixtureKey: 'provider_v1' },
  ])('fails closed for malformed or expanded payloads', (payload) => {
    expect(() => parseAiSyntheticJobPayloadV1(payload as BackgroundJobJsonObject)).toThrow(/AI synthetic/i);
  });
});
