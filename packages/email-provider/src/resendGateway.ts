import {
  RESEND_API_ENDPOINT,
  RESEND_AUTOMATIC_RETRY_WINDOW_MS,
  RESEND_PROVIDER_NAME,
  type DurableResendEmailDispatch,
  type EmailMessageInput,
  type NormalizedEmailMessage,
  type ResendDispatchOptions,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
  type ResendEmailGatewayConfig,
  type ResendLegacyDispatchOptions,
} from './contracts';
import {
  DurableResendDispatchError,
  assertDurableResendEmailDispatchIntegrity,
  createCanonicalResendRequestBody,
} from './durableDispatch';
import { normalizeEmailMessage } from './normalization';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:/-]{1,256}$/;
const PROVIDER_MESSAGE_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const MAX_PROVIDER_RESPONSE_BYTES = 65_536;
const MAX_TIMEOUT_MS = 10 * 60 * 1_000;

type ResendProviderErrorName =
  | 'invalid_idempotency_key'
  | 'validation_error'
  | 'missing_api_key'
  | 'restricted_api_key'
  | 'invalid_api_key'
  | 'not_found'
  | 'method_not_allowed'
  | 'invalid_idempotent_request'
  | 'concurrent_idempotent_requests'
  | 'invalid_attachment'
  | 'invalid_from_address'
  | 'invalid_access'
  | 'invalid_parameter'
  | 'invalid_region'
  | 'missing_required_field'
  | 'monthly_quota_exceeded'
  | 'daily_quota_exceeded'
  | 'rate_limit_exceeded'
  | 'security_error'
  | 'application_error'
  | 'internal_server_error';

const PROVIDER_ERROR_NAMES = new Set<ResendProviderErrorName>([
  'invalid_idempotency_key',
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'not_found',
  'method_not_allowed',
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_access',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
  'monthly_quota_exceeded',
  'daily_quota_exceeded',
  'rate_limit_exceeded',
  'security_error',
  'application_error',
  'internal_server_error',
]);

const AUTH_ERRORS = new Set<ResendProviderErrorName>([
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'invalid_access',
]);

const VALIDATION_ERRORS = new Set<ResendProviderErrorName>([
  'invalid_idempotency_key',
  'validation_error',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
]);

const QUOTA_ERRORS = new Set<ResendProviderErrorName>([
  'monthly_quota_exceeded',
  'daily_quota_exceeded',
]);

export type ResendGatewayConfigurationErrorCode =
  | 'RESEND_API_KEY_INVALID'
  | 'RESEND_FETCH_UNAVAILABLE'
  | 'RESEND_TIMEOUT_INVALID'
  | 'RESEND_LEGACY_IDEMPOTENCY_KEY_INVALID';

export class ResendGatewayConfigurationError extends Error {
  readonly code: ResendGatewayConfigurationErrorCode;

  constructor(code: ResendGatewayConfigurationErrorCode) {
    super(code);
    this.name = 'ResendGatewayConfigurationError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function providerErrorName(value: unknown): ResendProviderErrorName | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  return PROVIDER_ERROR_NAMES.has(value.name as ResendProviderErrorName)
    ? (value.name as ResendProviderErrorName)
    : null;
}

function acceptedMessageId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const id = value.id.trim();
  return PROVIDER_MESSAGE_ID.test(id) ? id : null;
}

function duration(now: () => number, startedAt: number): number {
  const elapsed = now() - startedAt;
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0;
}

export function parseRetryAfterMs(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (typeof value !== 'string' || !Number.isFinite(nowMs)) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    const milliseconds = seconds * 1_000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : null;
  }

  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(normalized)) {
    return null;
  }
  const retryAtMs = Date.parse(normalized);
  if (!Number.isFinite(retryAtMs)) return null;
  return Math.max(0, Math.ceil(retryAtMs - nowMs));
}

function validateOptions(options: ResendDispatchOptions): void {
  if (
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new ResendGatewayConfigurationError('RESEND_TIMEOUT_INVALID');
  }
}

type AbortKind = 'external' | 'timeout';

async function parseJsonResponse(response: Response, abortPromise: Promise<never>): Promise<unknown> {
  const raw = await Promise.race([response.text(), abortPromise]);
  if (raw.length > MAX_PROVIDER_RESPONSE_BYTES) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function classifyResponse(
  response: Response,
  parsed: unknown,
  now: () => number,
  startedAt: number,
): ResendDispatchOutcome {
  const durationMs = duration(now, startedAt);
  if (response.ok) {
    const messageId = acceptedMessageId(parsed);
    if (!messageId) {
      return {
        provider: RESEND_PROVIDER_NAME,
        outcome: 'uncertain',
        code: 'RESEND_RESPONSE_INVALID',
        statusCode: response.status,
        durationMs,
      };
    }
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      messageId,
      statusCode: response.status,
      durationMs,
    };
  }

  if (response.status >= 500) {
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'uncertain',
      code: 'RESEND_SERVER_ERROR',
      statusCode: response.status,
      durationMs,
    };
  }

  const errorName = providerErrorName(parsed);
  if (!errorName) {
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'uncertain',
      code: 'RESEND_RESPONSE_INVALID',
      statusCode: response.status,
      durationMs,
    };
  }

  if (errorName === 'invalid_idempotent_request') {
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'idempotency_conflict',
      code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
      statusCode: response.status,
      durationMs,
    };
  }
  if (errorName === 'concurrent_idempotent_requests') {
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'retryable_rejection',
      code: 'RESEND_IDEMPOTENCY_IN_PROGRESS',
      statusCode: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after'), now()),
      durationMs,
    };
  }
  if (errorName === 'rate_limit_exceeded') {
    return {
      provider: RESEND_PROVIDER_NAME,
      outcome: 'retryable_rejection',
      code: 'RESEND_RATE_LIMITED',
      statusCode: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after'), now()),
      durationMs,
    };
  }

  const code = AUTH_ERRORS.has(errorName)
    ? 'RESEND_AUTH_REJECTED'
    : VALIDATION_ERRORS.has(errorName)
      ? 'RESEND_VALIDATION_REJECTED'
      : QUOTA_ERRORS.has(errorName)
        ? 'RESEND_QUOTA_REJECTED'
        : 'RESEND_REQUEST_REJECTED';
  return {
    provider: RESEND_PROVIDER_NAME,
    outcome: 'terminal_rejection',
    code,
    statusCode: response.status,
    durationMs,
  };
}

function notDispatched(
  code: 'RESEND_ABORTED_BEFORE_DISPATCH' | 'RESEND_IDEMPOTENCY_EXPIRED',
): ResendDispatchOutcome {
  return {
    provider: RESEND_PROVIDER_NAME,
    outcome: 'not_dispatched',
    code,
    statusCode: null,
    durationMs: 0,
  };
}

export function createResendEmailGateway(config: ResendEmailGatewayConfig): ResendEmailGateway {
  const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
  if (!apiKey || /[\r\n]/.test(apiKey)) {
    throw new ResendGatewayConfigurationError('RESEND_API_KEY_INVALID');
  }
  const fetchImplementation = config.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new ResendGatewayConfigurationError('RESEND_FETCH_UNAVAILABLE');
  }
  const now = config.now ?? Date.now;

  async function dispatchRequest(
    canonicalRequestBody: string,
    options: ResendDispatchOptions,
    idempotencyKey?: string,
  ): Promise<ResendDispatchOutcome> {
    validateOptions(options);
    if (options.signal?.aborted) return notDispatched('RESEND_ABORTED_BEFORE_DISPATCH');

    const startedAt = now();
    const controller = new AbortController();
    let abortKind: AbortKind | null = null;
    let rejectAbort!: () => void;
    const abortPromise = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error('RESEND_REQUEST_ABORTED'));
    });
    const abort = (kind: AbortKind) => {
      if (abortKind) return;
      abortKind = kind;
      controller.abort();
      rejectAbort();
    };
    const onExternalAbort = () => abort('external');
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => abort('timeout'), options.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

      const response = await Promise.race([
        fetchImplementation(RESEND_API_ENDPOINT, {
          method: 'POST',
          headers,
          body: canonicalRequestBody,
          signal: controller.signal,
        }),
        abortPromise,
      ]);
      const parsed = await parseJsonResponse(response, abortPromise);
      return classifyResponse(response, parsed, now, startedAt);
    } catch {
      const code = abortKind === 'timeout'
        ? 'RESEND_TIMEOUT'
        : abortKind === 'external'
          ? 'RESEND_ABORTED'
          : 'RESEND_NETWORK_ERROR';
      return {
        provider: RESEND_PROVIDER_NAME,
        outcome: 'uncertain',
        code,
        statusCode: null,
        durationMs: duration(now, startedAt),
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  return Object.freeze({
    dispatchDurable: async (
      dispatch: DurableResendEmailDispatch,
      options: ResendDispatchOptions,
    ): Promise<ResendDispatchOutcome> => {
      assertDurableResendEmailDispatchIntegrity(dispatch);
      const nowMs = now();
      const expiresAtMs = Date.parse(dispatch.idempotencyExpiresAt);
      if (expiresAtMs <= nowMs) {
        return notDispatched('RESEND_IDEMPOTENCY_EXPIRED');
      }
      if (expiresAtMs - nowMs > RESEND_AUTOMATIC_RETRY_WINDOW_MS) {
        throw new DurableResendDispatchError('RESEND_DISPATCH_EXPIRY_INVALID');
      }
      return dispatchRequest(dispatch.canonicalRequestBody, options, dispatch.idempotencyKey);
    },
    dispatchLegacy: async (
      message: EmailMessageInput | NormalizedEmailMessage,
      options: ResendLegacyDispatchOptions,
    ): Promise<ResendDispatchOutcome> => {
      if (options.idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(options.idempotencyKey)) {
        throw new ResendGatewayConfigurationError('RESEND_LEGACY_IDEMPOTENCY_KEY_INVALID');
      }
      const normalizedMessage = normalizeEmailMessage(message);
      return dispatchRequest(
        createCanonicalResendRequestBody(normalizedMessage),
        options,
        options.idempotencyKey,
      );
    },
  });
}
