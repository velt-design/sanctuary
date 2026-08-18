import type { BackgroundJobHandler, BackgroundJobHandlerRpc } from '../runtime/contracts';
import { describe, expect, it, vi } from 'vitest';

import { aiSyntheticHandler } from './aiSynthetic';

const TASK_ID = 'ff2c34be-b033-403d-9bb9-8486f6b3cbb8';
const LEASE_TOKEN = '22222222-2222-4222-8222-222222222222';

function handlerContext(
  fixtureKey: 'echo_v1' | 'classification_v1' = 'echo_v1',
  payloadOverrides: Record<string, unknown> = {},
): Parameters<BackgroundJobHandler>[0] {
  const progress = vi.fn(async () => ({ status: 'running' }));
  const rpc = {
    progress,
    recordEffectCheckpoint: vi.fn(),
    refreshEffects: vi.fn(async () => []),
  } as unknown as BackgroundJobHandlerRpc;

  return {
    claim: {
      jobId: '11111111-1111-4111-8111-111111111111',
      kind: 'ai_synthetic_v1',
      contractVersion: 1,
      status: 'running',
      currentPhase: 'running',
      attemptNumber: 1,
      maxAttempts: 3,
      queueMessageId: 42,
      leaseToken: LEASE_TOKEN,
      leaseExpiresAt: '2026-08-18T01:02:03.000Z',
      cancellationRequestedAt: null,
      rolloutMode: 'worker_enabled',
      executionOwner: 'worker',
    },
    payload: {
      contractVersion: 1,
      payloadHash: 'a'.repeat(64),
      payload: {
        contractVersion: 1,
        taskId: TASK_ID,
        inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
        fixtureKey,
        ...payloadOverrides,
      },
    },
    effects: [],
    signal: new AbortController().signal,
    rpc,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    clock: {
      now: () => Date.parse('2026-08-18T01:02:03.000Z'),
      sleep: vi.fn(async () => undefined),
    },
  };
}

describe('AI synthetic worker handler', () => {
  it.each([
    ['echo_v1', 'SYNTHETIC_OK'],
    ['classification_v1', 'SYNTHETIC_ONLY'],
  ] as const)('records bounded progress and returns the fixed %s result', async (fixtureKey, resultCode) => {
    const context = handlerContext(fixtureKey);
    await expect(aiSyntheticHandler(context)).resolves.toEqual({
      safeResult: { resultCode, processedCount: 1 },
    });
    expect(context.rpc.progress).toHaveBeenCalledWith({
      status: 'running',
      phase: 'synthetic_evaluation',
      safeProgress: {
        phase: 'synthetic_evaluation',
        progressCode: 'deterministic_fixture',
        processedCount: 0,
        totalCount: 1,
      },
    });
    expect(context.rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
  });

  it('quarantines expanded or malformed payloads without calling a provider or effect boundary', async () => {
    const context = handlerContext('echo_v1', { unexpected: true });
    await expect(aiSyntheticHandler(context)).rejects.toMatchObject({
      code: 'AI_SYNTHETIC_PAYLOAD_INVALID',
      disposition: 'needs_attention',
    });
    expect(context.rpc.progress).not.toHaveBeenCalled();
    expect(context.rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
  });
});
