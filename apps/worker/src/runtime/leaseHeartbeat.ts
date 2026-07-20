import type { BackgroundJobClaim } from '@sp/jobs';

import type { RuntimeBackgroundJobsRpc, RuntimeClock, RuntimeLogger } from './contracts';
import { BackgroundJobAbortError } from './errors';

export type BackgroundJobLeaseHeartbeat = Readonly<{
  beginTerminalMutation(): void;
  renewNow(): Promise<void>;
  stop(): Promise<void>;
}>;

type StartBackgroundJobLeaseHeartbeatInput = Readonly<{
  claim: BackgroundJobClaim;
  workerId: string;
  rpc: RuntimeBackgroundJobsRpc;
  logger: RuntimeLogger;
  clock: RuntimeClock;
  visibilityTimeoutSeconds: number;
  heartbeatIntervalMs: number;
  onUnhealthy(errorCode: string): void;
}>;

function ownedJob(claim: BackgroundJobClaim, workerId: string) {
  return { jobId: claim.jobId, workerId, leaseToken: claim.leaseToken } as const;
}

export function startBackgroundJobLeaseHeartbeat(
  input: StartBackgroundJobLeaseHeartbeatInput,
  executionController: AbortController,
): BackgroundJobLeaseHeartbeat {
  const stopController = new AbortController();
  let stopped = false;
  let terminalMutationInProgress = false;
  let renewalInFlight: Promise<void> | null = null;

  const renew = () => {
    if (renewalInFlight) return renewalInFlight;
    const operation = (async () => {
      try {
        const job = await input.rpc.heartbeat({
          ...ownedJob(input.claim, input.workerId),
          visibilityTimeoutSeconds: input.visibilityTimeoutSeconds,
        });
        if (job.cancellationRequestedAt && !executionController.signal.aborted) {
          executionController.abort(new BackgroundJobAbortError('cancellation'));
        }
      } catch {
        if (terminalMutationInProgress || stopController.signal.aborted) return;
        input.logger.error('background_job.heartbeat_failed', {
          workerId: input.workerId,
          jobId: input.claim.jobId,
          kind: input.claim.kind,
          errorCode: 'LEASE_HEARTBEAT_FAILED',
        });
        input.onUnhealthy('LEASE_HEARTBEAT_FAILED');
        if (!executionController.signal.aborted) {
          executionController.abort(new BackgroundJobAbortError('heartbeat_failed'));
        }
        throw new BackgroundJobAbortError('heartbeat_failed');
      }
    })();
    renewalInFlight = operation;
    void operation.then(
      () => {
        if (renewalInFlight === operation) renewalInFlight = null;
      },
      () => {
        if (renewalInFlight === operation) renewalInFlight = null;
      },
    );
    return operation;
  };

  const done = (async () => {
    while (!stopController.signal.aborted) {
      try {
        await input.clock.sleep(input.heartbeatIntervalMs, stopController.signal);
      } catch {
        return;
      }
      if (stopController.signal.aborted) return;

      try {
        await renew();
      } catch {
        return;
      }
    }
  })();

  return {
    beginTerminalMutation: () => {
      terminalMutationInProgress = true;
    },
    renewNow: renew,
    stop: async () => {
      if (!stopped) {
        stopped = true;
        stopController.abort(new BackgroundJobAbortError('shutdown'));
      }
      await done;
    },
  };
}
