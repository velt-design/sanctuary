import 'server-only';

import { supabaseServiceRole } from '@/lib/supabaseClient';

const PROVIDER_ACCEPTANCE_RECONCILIATION_OUTCOMES = [
  'accepted',
  'reconciled',
  'already_accepted',
  'duplicate',
  'unmatched',
  'conflict',
] as const;

type ProviderAcceptanceReconciliationOutcome =
  (typeof PROVIDER_ACCEPTANCE_RECONCILIATION_OUTCOMES)[number];

type VerifiedProviderAcceptance = Readonly<{
  provider: 'resend';
  eventId: string;
  eventType: 'email.sent';
  providerMessageId: string;
  occurredAt: string;
  taggedJobId: string;
  taggedEffectRef: string;
}>;

type ProviderWebhookRepositoryErrorCode =
  | 'PROVIDER_RECONCILIATION_CONFLICT'
  | 'PROVIDER_RECONCILIATION_REJECTED'
  | 'PROVIDER_RECONCILIATION_FAILED'
  | 'PROVIDER_RECONCILIATION_INVALID_RESPONSE';

export class ProviderWebhookRepositoryError extends Error {
  readonly code: ProviderWebhookRepositoryErrorCode;

  constructor(code: ProviderWebhookRepositoryErrorCode) {
    super(code);
    this.name = 'ProviderWebhookRepositoryError';
    this.code = code;
  }
}

function parseOutcome(value: unknown): ProviderAcceptanceReconciliationOutcome {
  if (
    typeof value !== 'string' ||
    !(PROVIDER_ACCEPTANCE_RECONCILIATION_OUTCOMES as readonly string[]).includes(value)
  ) {
    throw new ProviderWebhookRepositoryError('PROVIDER_RECONCILIATION_INVALID_RESPONSE');
  }
  return value as ProviderAcceptanceReconciliationOutcome;
}

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const code = (error as Readonly<Record<string, unknown>>).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Persists an already signature-verified provider envelope through one narrow
 * service-role RPC. Raw bodies, signatures, recipients, and content never
 * cross this repository boundary.
 */
export async function reconcileVerifiedProviderAcceptance(
  input: VerifiedProviderAcceptance,
): Promise<ProviderAcceptanceReconciliationOutcome> {
  const { data, error } = await supabaseServiceRole.rpc(
    'background_job_reconcile_verified_provider_acceptance',
    {
      p_provider_name: input.provider,
      p_provider_event_id: input.eventId,
      p_provider_event_type: input.eventType,
      p_provider_message_id: input.providerMessageId,
      p_provider_created_at: input.occurredAt,
      p_tagged_job_id: input.taggedJobId,
      p_tagged_effect_ref: input.taggedEffectRef,
    },
  );

  if (error) {
    const code = databaseErrorCode(error);
    if (code === '23505') {
      throw new ProviderWebhookRepositoryError('PROVIDER_RECONCILIATION_CONFLICT');
    }
    if (code === '22023') {
      throw new ProviderWebhookRepositoryError('PROVIDER_RECONCILIATION_REJECTED');
    }
    throw new ProviderWebhookRepositoryError('PROVIDER_RECONCILIATION_FAILED');
  }

  return parseOutcome(data);
}
