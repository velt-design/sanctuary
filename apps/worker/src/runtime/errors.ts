type BackgroundJobFailureDisposition = 'retry' | 'needs_attention' | 'permanent_failure';

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,95}$/;

export class BackgroundJobHandlerError extends Error {
  readonly code: string;
  readonly disposition: BackgroundJobFailureDisposition;

  constructor(input: Readonly<{
    code: string;
    disposition: BackgroundJobFailureDisposition;
    cause?: unknown;
  }>) {
    super(input.code, { cause: input.cause });
    if (!SAFE_ERROR_CODE.test(input.code)) {
      throw new RangeError('Background-job handler error code must be a safe upper-case code');
    }
    this.name = 'BackgroundJobHandlerError';
    this.code = input.code;
    this.disposition = input.disposition;
  }
}

type BackgroundJobAbortReason = 'cancellation' | 'heartbeat_failed' | 'shutdown' | 'timeout';

export class BackgroundJobAbortError extends Error {
  readonly reason: BackgroundJobAbortReason;

  constructor(reason: BackgroundJobAbortReason) {
    super(`BACKGROUND_JOB_${reason.toUpperCase()}`);
    this.name = 'BackgroundJobAbortError';
    this.reason = reason;
  }
}

export function toBackgroundJobHandlerError(error: unknown): BackgroundJobHandlerError {
  if (error instanceof BackgroundJobHandlerError) return error;
  if (error instanceof BackgroundJobAbortError) {
    switch (error.reason) {
      case 'timeout':
        return new BackgroundJobHandlerError({ code: 'EXECUTION_TIMEOUT', disposition: 'retry', cause: error });
      case 'heartbeat_failed':
        return new BackgroundJobHandlerError({ code: 'LEASE_HEARTBEAT_FAILED', disposition: 'needs_attention', cause: error });
      case 'shutdown':
        return new BackgroundJobHandlerError({ code: 'WORKER_SHUTDOWN', disposition: 'retry', cause: error });
      case 'cancellation':
        return new BackgroundJobHandlerError({ code: 'CANCELLATION_REQUESTED', disposition: 'needs_attention', cause: error });
    }
  }
  return new BackgroundJobHandlerError({
    code: 'UNHANDLED_HANDLER_ERROR',
    disposition: 'retry',
    cause: error,
  });
}
