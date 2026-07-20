import type { BackgroundJobClaim } from '@sp/jobs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeBackgroundJobsRpc, RuntimeLogger } from './contracts';
import { systemRuntimeClock } from './contracts';
import { startBackgroundJobLeaseHeartbeat } from './leaseHeartbeat';

const claim = {
  jobId: '11111111-1111-4111-8111-111111111111',
  kind: 'quote_send',
  contractVersion: 1,
  status: 'dispatching',
  currentPhase: 'provider_dispatch',
  attemptNumber: 1,
  maxAttempts: 6,
  queueMessageId: 42,
  leaseToken: '22222222-2222-4222-8222-222222222222',
  leaseExpiresAt: '2026-07-20T01:04:03.000Z',
  cancellationRequestedAt: null,
  rolloutMode: 'worker_enabled',
  executionOwner: 'worker',
} as const satisfies BackgroundJobClaim;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('background-job lease heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-20T01:02:03.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drains an in-flight renewal and suppresses new renewals while paused', async () => {
    const firstRenewal = deferred<{ cancellationRequestedAt: null }>();
    const heartbeatRpc = vi.fn()
      .mockImplementationOnce(() => firstRenewal.promise)
      .mockResolvedValue({ cancellationRequestedAt: null });
    const rpc = { heartbeat: heartbeatRpc } as unknown as RuntimeBackgroundJobsRpc;
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } satisfies RuntimeLogger;
    const executionController = new AbortController();
    const onUnhealthy = vi.fn();
    const heartbeat = startBackgroundJobLeaseHeartbeat({
      claim,
      workerId: 'worker-1',
      rpc,
      logger,
      clock: systemRuntimeClock,
      visibilityTimeoutSeconds: 120,
      heartbeatIntervalMs: 1_000,
      onUnhealthy,
    }, executionController);

    const renewal = heartbeat.renewNow();
    await vi.waitFor(() => expect(heartbeatRpc).toHaveBeenCalledOnce());
    let pauseAcquired = false;
    const pause = heartbeat.pauseRenewal().then((resume) => {
      pauseAcquired = true;
      return resume;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pauseAcquired).toBe(false);

    firstRenewal.resolve({ cancellationRequestedAt: null });
    await renewal;
    const resume = await pause;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(heartbeatRpc).toHaveBeenCalledOnce();

    resume();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(heartbeatRpc).toHaveBeenCalledTimes(2);
    expect(onUnhealthy).not.toHaveBeenCalled();
    expect(executionController.signal.aborted).toBe(false);
    await heartbeat.stop();
  });
});
