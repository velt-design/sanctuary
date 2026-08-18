import {
  executeAiSyntheticFixture,
  parseAiSyntheticJobPayloadV1,
  type BackgroundJobSafeResultSummary,
} from '@sp/jobs';

import { BackgroundJobHandlerError } from '../runtime/errors';
import type { BackgroundJobHandler } from '../runtime/contracts';

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason;
}

export const aiSyntheticHandler: BackgroundJobHandler = async ({ payload, signal, rpc }) => {
  throwIfAborted(signal);

  let parsedPayload;
  try {
    parsedPayload = parseAiSyntheticJobPayloadV1(payload.payload);
  } catch (error) {
    throw new BackgroundJobHandlerError({
      code: 'AI_SYNTHETIC_PAYLOAD_INVALID',
      disposition: 'needs_attention',
      cause: error,
    });
  }

  await rpc.progress({
    status: 'running',
    phase: 'synthetic_evaluation',
    safeProgress: {
      phase: 'synthetic_evaluation',
      progressCode: 'deterministic_fixture',
      processedCount: 0,
      totalCount: 1,
    },
  });
  throwIfAborted(signal);

  const result = executeAiSyntheticFixture(parsedPayload);
  return {
    safeResult: result satisfies BackgroundJobSafeResultSummary,
  };
};
