import 'server-only';

import { createHash } from 'node:crypto';

import { supabaseServiceRole } from '../supabaseClient';

const COMMERCIAL_EMAIL_IDEMPOTENCY_WINDOW_MS = 20 * 60 * 60 * 1_000;
export const COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE =
  'COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY';
const COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_MESSAGE =
  'Commercial workflow upgrade is not installed. Apply migration 20260728_000001_commercial_workflow_trust.sql, then refresh.';

type CommercialEmailKind =
  | 'quote_send'
  | 'quote_resend'
  | 'deposit_invoice_send';

type CommercialEmailIntentStatus =
  | 'prepared'
  | 'dispatching'
  | 'provider_accepted'
  | 'finalised'
  | 'failed'
  | 'needs_attention';

type CommercialEmailProtectedPayload = Readonly<Record<string, unknown>>;

export class CommercialWorkflowSchemaNotReadyError extends Error {
  readonly code = COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE;

  constructor() {
    super(COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_MESSAGE);
    this.name = 'CommercialWorkflowSchemaNotReadyError';
  }
}

export function isCommercialWorkflowSchemaNotReadyError(
  error: unknown,
): error is CommercialWorkflowSchemaNotReadyError {
  return error instanceof CommercialWorkflowSchemaNotReadyError;
}

export type CommercialEmailIntent = Readonly<{
  id: string;
  intentKey: string;
  kind: CommercialEmailKind;
  subjectId: string;
  projectId: string | null;
  payloadHash: string;
  protectedPayload: CommercialEmailProtectedPayload;
  status: CommercialEmailIntentStatus;
  providerName: 'resend';
  providerIdempotencyKey: string;
  providerIdempotencyExpiresAt: string;
  providerMessageId: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}>;

type PrepareCommercialEmailIntentInput = Readonly<{
  intentKey: string;
  kind: CommercialEmailKind;
  subjectId: string;
  projectId: string | null;
  protectedPayload: CommercialEmailProtectedPayload;
  nowMs?: number;
}>;

type PrepareQuoteDeliveryEmailIntentInput =
  PrepareCommercialEmailIntentInput &
    Readonly<{
      quoteVersionId: string;
      expectedCommercialRevision: number;
      kind: 'quote_send';
    }>;

interface JsonObject {
  readonly [key: string]: JsonValue;
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const objectValue = value as JsonObject;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(',')}}`;
}

export function commercialEmailPayloadHash(
  payload: CommercialEmailProtectedPayload,
): string {
  return createHash('sha256')
    .update(canonicalJson(payload as Readonly<Record<string, JsonValue>>))
    .digest('hex');
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Commercial email intent is missing ${key}`);
  }
  return value;
}

function mapIntent(value: unknown): CommercialEmailIntent {
  const row = firstRow(value);
  if (!row) throw new Error('Commercial email intent was not found');
  const protectedPayload = row.protected_payload;
  if (
    !protectedPayload ||
    typeof protectedPayload !== 'object' ||
    Array.isArray(protectedPayload)
  ) {
    throw new Error('Commercial email intent payload is unavailable');
  }
  return {
    id: requiredString(row, 'id'),
    intentKey: requiredString(row, 'intent_key'),
    kind: requiredString(row, 'kind') as CommercialEmailKind,
    subjectId: requiredString(row, 'subject_id'),
    projectId:
      typeof row.project_id === 'string' && row.project_id.trim()
        ? row.project_id
        : null,
    payloadHash: requiredString(row, 'payload_hash'),
    protectedPayload: protectedPayload as CommercialEmailProtectedPayload,
    status: requiredString(row, 'status') as CommercialEmailIntentStatus,
    providerName: 'resend',
    providerIdempotencyKey: requiredString(
      row,
      'provider_idempotency_key',
    ),
    providerIdempotencyExpiresAt: requiredString(
      row,
      'provider_idempotency_expires_at',
    ),
    providerMessageId:
      typeof row.provider_message_id === 'string' &&
      row.provider_message_id.trim()
        ? row.provider_message_id
        : null,
    attemptCount: Number(row.attempt_count ?? 0) || 0,
    lastErrorCode:
      typeof row.last_error_code === 'string' && row.last_error_code.trim()
        ? row.last_error_code
        : null,
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
  };
}

function databaseCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function databaseMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function commercialEmailRpcError(
  error: unknown,
  fallback: string,
): Error {
  const code = databaseCode(error);
  const message = databaseMessage(error);
  const normalizedMessage = message.toLowerCase();
  const commercialSchemaReference =
    normalizedMessage.includes('commercial_email') ||
    normalizedMessage.includes('commercial quote') ||
    normalizedMessage.includes('commercial workflow');
  if (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42883' ||
    (commercialSchemaReference &&
      (normalizedMessage.includes('schema cache') ||
        normalizedMessage.includes('does not exist') ||
        normalizedMessage.includes('could not find')))
  ) {
    return new CommercialWorkflowSchemaNotReadyError();
  }
  return new Error(message || fallback);
}

export async function findCommercialEmailIntentByKey(
  intentKey: string,
): Promise<CommercialEmailIntent | null> {
  const result = await supabaseServiceRole.rpc('commercial_email_read_by_key', {
    p_intent_key: intentKey,
  });
  if (result.error) {
    throw commercialEmailRpcError(
      result.error,
      'Failed to load commercial email intent',
    );
  }
  return firstRow(result.data) ? mapIntent(result.data) : null;
}

export async function findUnfinishedCommercialEmailIntent(
  kind: CommercialEmailKind,
  subjectId: string,
): Promise<CommercialEmailIntent | null> {
  const result = await supabaseServiceRole.rpc(
    'commercial_email_read_unfinished',
    {
      p_kind: kind,
      p_subject_id: subjectId,
    },
  );
  if (result.error) {
    throw commercialEmailRpcError(
      result.error,
      'Failed to load unfinished commercial email',
    );
  }
  return firstRow(result.data) ? mapIntent(result.data) : null;
}

export async function inspectUnfinishedCommercialEmailIntent(
  kind: CommercialEmailKind,
  subjectId: string,
): Promise<
  | { schemaReady: true; intent: CommercialEmailIntent | null }
  | { schemaReady: false; intent: null }
> {
  try {
    return {
      schemaReady: true,
      intent: await findUnfinishedCommercialEmailIntent(kind, subjectId),
    };
  } catch (error) {
    if (isCommercialWorkflowSchemaNotReadyError(error)) {
      return { schemaReady: false, intent: null };
    }
    throw error;
  }
}

async function readCommercialEmailIntent(
  intentId: string,
): Promise<CommercialEmailIntent> {
  const result = await supabaseServiceRole.rpc('commercial_email_read', {
    p_intent_id: intentId,
  });
  if (result.error) {
    throw commercialEmailRpcError(
      result.error,
      'Failed to load commercial email intent',
    );
  }
  return mapIntent(result.data);
}

export async function prepareCommercialEmailIntent(
  input: PrepareCommercialEmailIntentInput,
): Promise<CommercialEmailIntent> {
  const payloadHash = commercialEmailPayloadHash(input.protectedPayload);
  const expiresAt = new Date(
    (input.nowMs ?? Date.now()) + COMMERCIAL_EMAIL_IDEMPOTENCY_WINDOW_MS,
  ).toISOString();
  const result = await supabaseServiceRole.rpc('commercial_email_prepare', {
    p_intent_key: input.intentKey,
    p_kind: input.kind,
    p_subject_id: input.subjectId,
    p_project_id: input.projectId,
    p_payload_hash: payloadHash,
    p_protected_payload: input.protectedPayload,
    p_provider_idempotency_expires_at: expiresAt,
  });
  if (result.error) {
    if (databaseCode(result.error) === '23505') {
      const winner = await findCommercialEmailIntentByKey(input.intentKey);
      if (winner) {
        if (
          winner.kind === input.kind &&
          winner.subjectId === input.subjectId &&
          winner.projectId === input.projectId &&
          winner.payloadHash === payloadHash
        ) {
          return winner;
        }
        throw new Error(
          'This delivery intent already belongs to different frozen content',
        );
      }
      const unfinished = await findUnfinishedCommercialEmailIntent(
        input.kind,
        input.subjectId,
      );
      if (unfinished) {
        throw new Error(
          'A delivery is already prepared for this record. Retry the prepared delivery instead.',
        );
      }
    }
    throw commercialEmailRpcError(
      result.error,
      'Failed to prepare commercial email intent',
    );
  }

  const safeRow = firstRow(result.data);
  if (!safeRow) throw new Error('Commercial email intent was not prepared');
  return readCommercialEmailIntent(requiredString(safeRow, 'id'));
}

export async function prepareQuoteDeliveryEmailIntent(
  input: PrepareQuoteDeliveryEmailIntentInput,
): Promise<CommercialEmailIntent> {
  const payloadHash = commercialEmailPayloadHash(input.protectedPayload);
  const expiresAt = new Date(
    (input.nowMs ?? Date.now()) + COMMERCIAL_EMAIL_IDEMPOTENCY_WINDOW_MS,
  ).toISOString();
  const result = await supabaseServiceRole.rpc(
    'commercial_quote_prepare_delivery_email',
    {
      p_quote_version_id: input.quoteVersionId,
      p_expected_commercial_revision: input.expectedCommercialRevision,
      p_intent_key: input.intentKey,
      p_kind: input.kind,
      p_subject_id: input.subjectId,
      p_project_id: input.projectId,
      p_payload_hash: payloadHash,
      p_protected_payload: input.protectedPayload,
      p_provider_idempotency_expires_at: expiresAt,
    },
  );
  if (result.error) {
    const code = databaseCode(result.error);
    const message = result.error.message ?? 'Failed to prepare quote delivery';
    if (code === '40001' || message.includes('QUOTE_STALE')) {
      throw new Error(
        'Quote changed after this delivery review. Review it again before sending.',
      );
    }
    if (code === '55000' || message.includes('Quote is locked')) {
      throw new Error('This quote version is no longer available for delivery');
    }
    if (code === '23505') {
      throw new Error(
        'A delivery is already prepared for this quote. Retry the prepared delivery instead.',
      );
    }
    throw commercialEmailRpcError(result.error, message);
  }
  const row = firstRow(result.data);
  if (!row) throw new Error('Quote delivery intent was not prepared');
  return readCommercialEmailIntent(requiredString(row, 'intent_id'));
}

async function callIntentMutation(
  name:
    | 'commercial_email_mark_dispatching'
    | 'commercial_email_mark_provider_accepted'
    | 'commercial_email_mark_failed'
    | 'commercial_email_mark_finalised',
  parameters: Readonly<Record<string, unknown>>,
): Promise<void> {
  const result = await supabaseServiceRole.rpc(name, parameters);
  if (result.error) {
    throw commercialEmailRpcError(
      result.error,
      'Failed to update commercial email intent',
    );
  }
}

export async function markCommercialEmailDispatching(
  intentId: string,
): Promise<CommercialEmailIntent> {
  await callIntentMutation('commercial_email_mark_dispatching', {
    p_intent_id: intentId,
  });
  return readCommercialEmailIntent(intentId);
}

export async function markCommercialEmailProviderAccepted(
  intentId: string,
  providerMessageId: string,
): Promise<CommercialEmailIntent> {
  await callIntentMutation('commercial_email_mark_provider_accepted', {
    p_intent_id: intentId,
    p_provider_message_id: providerMessageId,
  });
  return readCommercialEmailIntent(intentId);
}

export async function markCommercialEmailFailed(
  intentId: string,
  errorCode: string,
  needsAttention: boolean,
): Promise<CommercialEmailIntent> {
  await callIntentMutation('commercial_email_mark_failed', {
    p_intent_id: intentId,
    p_error_code: errorCode,
    p_needs_attention: needsAttention,
  });
  return readCommercialEmailIntent(intentId);
}

export async function markCommercialEmailFinalised(
  intentId: string,
): Promise<CommercialEmailIntent> {
  await callIntentMutation('commercial_email_mark_finalised', {
    p_intent_id: intentId,
  });
  return readCommercialEmailIntent(intentId);
}

export function commercialEmailFailure(error: unknown): Readonly<{
  code: string;
  needsAttention: boolean;
}> {
  const record =
    error && typeof error === 'object'
      ? (error as Readonly<Record<string, unknown>>)
      : null;
  const code =
    typeof record?.code === 'string' && record.code.trim()
      ? record.code.trim()
      : 'EMAIL_DELIVERY_FAILED';
  const outcome =
    typeof record?.outcome === 'string' ? record.outcome : 'adapter_error';
  return {
    code,
    needsAttention:
      outcome === 'terminal_rejection' ||
      outcome === 'idempotency_conflict' ||
      outcome === 'adapter_error',
  };
}
