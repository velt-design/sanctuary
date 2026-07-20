export const RESEND_PROVIDER_NAME = 'resend' as const;
export const RESEND_API_ENDPOINT = 'https://api.resend.com/emails' as const;
/** Resend's documented server-side retention for idempotency keys. */
export const RESEND_PROVIDER_IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;
/** Deliberately leaves four hours of safety margin inside provider retention. */
export const RESEND_AUTOMATIC_RETRY_WINDOW_MS = 20 * 60 * 60 * 1_000;
export const RESEND_WEBHOOK_MAX_BODY_BYTES = 262_144;

export type EmailAttachmentInput = Readonly<{
  filename: string;
  /** Strings must contain standard base64. Uint8Array values are copied before encoding. */
  content: string | Uint8Array;
  contentType?: string;
}>;

export type EmailMessageInput = Readonly<{
  from: string;
  to: string | readonly string[];
  cc?: string | readonly string[];
  bcc?: string | readonly string[];
  replyTo?: string | readonly string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: readonly EmailAttachmentInput[];
}>;

export type NormalizedEmailAttachment = Readonly<{
  filename: string;
  contentBase64: string;
  contentType?: string;
}>;

export type NormalizedEmailMessage = Readonly<{
  from: string;
  to: readonly [string, ...string[]];
  cc?: readonly string[];
  bcc?: readonly string[];
  replyTo?: readonly string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: readonly NormalizedEmailAttachment[];
}>;

export type NormalizedEmailTag =
  | Readonly<{ name: 'job_id'; value: string }>
  | Readonly<{ name: 'effect_ref'; value: string }>;

export type DurableResendEmailDispatch = Readonly<{
  provider: typeof RESEND_PROVIDER_NAME;
  jobId: string;
  effectKey: string;
  idempotencyKey: string;
  effectRef: string;
  idempotencyExpiresAt: string;
  payloadHash: string;
  message: NormalizedEmailMessage;
  tags: readonly [NormalizedEmailTag, NormalizedEmailTag];
  /** Exact UTF-8 bytes sent to Resend. This belongs only in protected server memory/storage. */
  canonicalRequestBody: string;
}>;

export type ResendDispatchOptions = Readonly<{
  timeoutMs: number;
  signal?: AbortSignal;
}>;

export type ResendLegacyDispatchOptions = ResendDispatchOptions &
  Readonly<{
    idempotencyKey?: string;
  }>;

type ResendDispatchOutcomeBase = Readonly<{
  provider: typeof RESEND_PROVIDER_NAME;
  durationMs: number;
}>;

export type ResendAcceptedOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'accepted';
    code: 'RESEND_ACCEPTED';
    messageId: string;
    statusCode: number;
  }>;

export type ResendRetryableRejectionOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'retryable_rejection';
    code: 'RESEND_RATE_LIMITED' | 'RESEND_IDEMPOTENCY_IN_PROGRESS';
    statusCode: number;
    retryAfterMs: number | null;
  }>;

export type ResendTerminalRejectionOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'terminal_rejection';
    code:
      | 'RESEND_AUTH_REJECTED'
      | 'RESEND_VALIDATION_REJECTED'
      | 'RESEND_QUOTA_REJECTED'
      | 'RESEND_REQUEST_REJECTED';
    statusCode: number;
  }>;

export type ResendIdempotencyConflictOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'idempotency_conflict';
    code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT';
    statusCode: number;
  }>;

export type ResendUncertainOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'uncertain';
    code:
      | 'RESEND_TIMEOUT'
      | 'RESEND_ABORTED'
      | 'RESEND_NETWORK_ERROR'
      | 'RESEND_SERVER_ERROR'
      | 'RESEND_RESPONSE_INVALID';
    statusCode: number | null;
  }>;

export type ResendNotDispatchedOutcome = ResendDispatchOutcomeBase &
  Readonly<{
    outcome: 'not_dispatched';
    code: 'RESEND_ABORTED_BEFORE_DISPATCH' | 'RESEND_IDEMPOTENCY_EXPIRED';
    statusCode: null;
  }>;

export type ResendDispatchOutcome =
  | ResendAcceptedOutcome
  | ResendRetryableRejectionOutcome
  | ResendTerminalRejectionOutcome
  | ResendIdempotencyConflictOutcome
  | ResendUncertainOutcome
  | ResendNotDispatchedOutcome;

export type ResendEmailGatewayConfig = Readonly<{
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}>;

export interface ResendEmailGateway {
  dispatchDurable(
    dispatch: DurableResendEmailDispatch,
    options: ResendDispatchOptions,
  ): Promise<ResendDispatchOutcome>;
  dispatchLegacy(
    message: EmailMessageInput | NormalizedEmailMessage,
    options: ResendLegacyDispatchOptions,
  ): Promise<ResendDispatchOutcome>;
}

export type ResendWebhookHeaders = Readonly<{
  id: string;
  timestamp: string;
  signature: string;
}>;

export type VerifiedResendEmailSentWebhook = Readonly<{
  outcome: 'verified';
  provider: typeof RESEND_PROVIDER_NAME;
  eventType: 'email.sent';
  eventId: string;
  jobId: string;
  effectRef: string;
  messageId: string;
  occurredAt: string;
}>;

export type IgnoredResendWebhook = Readonly<{
  outcome: 'ignored';
  provider: typeof RESEND_PROVIDER_NAME;
  eventType: string;
  eventId: string;
  occurredAt: string;
}>;

export type ResendWebhookVerificationResult =
  | VerifiedResendEmailSentWebhook
  | IgnoredResendWebhook;

export type ResendWebhookErrorCode =
  | 'RESEND_WEBHOOK_HEADERS_INVALID'
  | 'RESEND_WEBHOOK_SECRET_INVALID'
  | 'RESEND_WEBHOOK_SIGNATURE_INVALID'
  | 'RESEND_WEBHOOK_SCHEMA_INVALID';
