import type { BackgroundJobKind, BackgroundJobRolloutMode, BackgroundJobStatus } from './contracts';

export type BackgroundJobConcurrencyClass = 'documents' | 'email' | 'orchestration';

export type BackgroundJobIdempotencyStrategy =
  | 'provider_and_effect_checkpoint'
  | 'input_hash_artifact_reuse'
  | 'event_intent'
  | 'outbox_intent';

export type BackgroundJobRetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maximumDelayMs: number;
  automaticRetryWindowMs: number;
}>;

export type BackgroundJobKindDefinition = Readonly<{
  kind: BackgroundJobKind;
  payloadContractVersion: number;
  handlerOwner: string;
  retry: BackgroundJobRetryPolicy;
  timeoutMs: number;
  concurrencyClass: BackgroundJobConcurrencyClass;
  hasExternalSideEffect: boolean;
  cancellationAllowed: boolean;
  /** Handler/domain checkpoints whose durability is owned outside the generic provider-effect ledger. */
  requiredHandlerCheckpoints: readonly string[];
  /** External `background_job_effects.effect_kind` values that must be finalised before completion. */
  requiredEffectCheckpoints: readonly string[];
  /** Fixed copy safe for staff-facing progress. Never substitute raw phases or provider errors. */
  userFacingStatus: Readonly<Record<BackgroundJobStatus, string>>;
  defaultRolloutMode: BackgroundJobRolloutMode;
  idempotencyStrategy: BackgroundJobIdempotencyStrategy;
}>;

const FIVE_MINUTES_MS = 5 * 60 * 1_000;
export const BACKGROUND_JOB_MAX_AUTOMATIC_RETRY_WINDOW_MS = 20 * 60 * 60 * 1_000;

const emailRetry = {
  maxAttempts: 6,
  baseDelayMs: 30_000,
  maximumDelayMs: 30 * 60 * 1_000,
  automaticRetryWindowMs: BACKGROUND_JOB_MAX_AUTOMATIC_RETRY_WINDOW_MS,
} as const;

const documentRetry = {
  maxAttempts: 4,
  baseDelayMs: 15_000,
  maximumDelayMs: 15 * 60 * 1_000,
  automaticRetryWindowMs: BACKGROUND_JOB_MAX_AUTOMATIC_RETRY_WINDOW_MS,
} as const;

const userFacingEmailStatus = {
  queued: 'Queued',
  claimed: 'Preparing',
  preparing: 'Preparing',
  running: 'Preparing',
  dispatching: 'Sending',
  provider_accepted: 'Finalising',
  finalising: 'Finalising',
  retrying: 'Retrying',
  succeeded: 'Sent',
  cancelled: 'Cancelled',
  needs_attention: 'Needs attention',
  permanent_failed: 'Permanently failed',
} as const;

const userFacingJobPackStatus = {
  queued: 'Queued',
  claimed: 'Preparing job pack',
  preparing: 'Preparing job pack',
  running: 'Generating job pack',
  dispatching: 'Finalising job pack',
  provider_accepted: 'Finalising job pack',
  finalising: 'Finalising job pack',
  retrying: 'Retrying',
  succeeded: 'Job pack ready',
  cancelled: 'Cancelled',
  needs_attention: 'Needs attention',
  permanent_failed: 'Permanently failed',
} as const;

const userFacingAutomationStatus = {
  queued: 'Queued',
  claimed: 'Preparing automation',
  preparing: 'Preparing automation',
  running: 'Running automation',
  dispatching: 'Finalising automation',
  provider_accepted: 'Finalising automation',
  finalising: 'Finalising automation',
  retrying: 'Retrying',
  succeeded: 'Automation complete',
  cancelled: 'Cancelled',
  needs_attention: 'Needs attention',
  permanent_failed: 'Permanently failed',
} as const;

export const BACKGROUND_JOB_REGISTRY = {
  deposit_invoice_prepare_and_send: {
    kind: 'deposit_invoice_prepare_and_send',
    payloadContractVersion: 1,
    handlerOwner: 'deposit-invoice-workflow',
    retry: emailRetry,
    timeoutMs: FIVE_MINUTES_MS,
    concurrencyClass: 'email',
    hasExternalSideEffect: true,
    cancellationAllowed: false,
    requiredHandlerCheckpoints: ['invoice_prepared', 'pdf_staged', 'business_finalised'],
    requiredEffectCheckpoints: ['email_dispatch'],
    userFacingStatus: { ...userFacingEmailStatus, succeeded: 'Invoice sent' },
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'provider_and_effect_checkpoint',
  },
  quote_send: {
    kind: 'quote_send',
    payloadContractVersion: 1,
    handlerOwner: 'quote-delivery-workflow',
    retry: emailRetry,
    timeoutMs: FIVE_MINUTES_MS,
    concurrencyClass: 'email',
    hasExternalSideEffect: true,
    cancellationAllowed: false,
    requiredHandlerCheckpoints: ['quote_frozen', 'pdf_staged', 'business_finalised'],
    requiredEffectCheckpoints: ['email_dispatch'],
    userFacingStatus: { ...userFacingEmailStatus, succeeded: 'Quote sent' },
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'provider_and_effect_checkpoint',
  },
  quote_resend: {
    kind: 'quote_resend',
    payloadContractVersion: 1,
    handlerOwner: 'quote-delivery-workflow',
    retry: emailRetry,
    timeoutMs: FIVE_MINUTES_MS,
    concurrencyClass: 'email',
    hasExternalSideEffect: true,
    cancellationAllowed: false,
    requiredHandlerCheckpoints: ['quote_frozen', 'pdf_staged', 'business_finalised'],
    requiredEffectCheckpoints: ['email_dispatch'],
    userFacingStatus: { ...userFacingEmailStatus, succeeded: 'Quote resent' },
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'provider_and_effect_checkpoint',
  },
  job_pack_generate: {
    kind: 'job_pack_generate',
    payloadContractVersion: 1,
    handlerOwner: 'job-pack-generation-workflow',
    retry: documentRetry,
    timeoutMs: 10 * 60 * 1_000,
    concurrencyClass: 'documents',
    hasExternalSideEffect: false,
    cancellationAllowed: true,
    requiredHandlerCheckpoints: ['inputs_frozen', 'artifacts_staged', 'business_finalised'],
    requiredEffectCheckpoints: [],
    userFacingStatus: userFacingJobPackStatus,
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'input_hash_artifact_reuse',
  },
  automation_event: {
    kind: 'automation_event',
    payloadContractVersion: 1,
    handlerOwner: 'automation-event-workflow',
    retry: documentRetry,
    timeoutMs: 2 * 60 * 1_000,
    concurrencyClass: 'orchestration',
    hasExternalSideEffect: false,
    cancellationAllowed: true,
    requiredHandlerCheckpoints: ['event_recorded', 'effects_persisted'],
    requiredEffectCheckpoints: [],
    userFacingStatus: userFacingAutomationStatus,
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'event_intent',
  },
  email_outbox_deliver: {
    kind: 'email_outbox_deliver',
    payloadContractVersion: 1,
    handlerOwner: 'email-outbox-delivery-workflow',
    retry: emailRetry,
    timeoutMs: 2 * 60 * 1_000,
    concurrencyClass: 'email',
    hasExternalSideEffect: true,
    cancellationAllowed: false,
    requiredHandlerCheckpoints: ['outbox_frozen', 'business_finalised'],
    requiredEffectCheckpoints: ['email_dispatch'],
    userFacingStatus: userFacingEmailStatus,
    defaultRolloutMode: 'legacy',
    idempotencyStrategy: 'outbox_intent',
  },
} as const satisfies Record<BackgroundJobKind, BackgroundJobKindDefinition>;

export function getBackgroundJobDefinition<K extends BackgroundJobKind>(kind: K): (typeof BACKGROUND_JOB_REGISTRY)[K] {
  return BACKGROUND_JOB_REGISTRY[kind];
}

export function getBackgroundJobUserFacingStatus(
  kind: BackgroundJobKind,
  status: BackgroundJobStatus,
): string {
  return BACKGROUND_JOB_REGISTRY[kind].userFacingStatus[status];
}
