import 'server-only';

import { deliverAcceptedDepositInvoiceById } from '../invoices/server';
import {
  normalizeMarketingConversionOccurredAt,
  recentMarketingConversionOccurrence,
  recordMarketingConversionEvent,
} from '../marketingAttribution/server';
import { reconcileQuoteOutcomeCadence } from '../projects/workItems/quoteCadenceReconciliation';
import { supabaseServiceRole } from '../supabaseClient';

type AcceptedQuoteInvoiceCommandResult = Readonly<{
  quoteVersionUuid: string;
  alreadyAccepted: boolean;
  invoice: Readonly<{
    id: string;
    invoiceRef: string;
    created: boolean;
    sent: boolean;
    sendError: string | null;
    deliveryState: 'sent' | 'retry_available' | 'needs_attention';
  }>;
}>;

export class QuoteAcceptanceCommandError extends Error {
  constructor(
    readonly code: 'QUOTE_EXPIRED' | 'QUOTE_NOT_ACCEPTABLE' | 'QUOTE_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'QuoteAcceptanceCommandError';
  }
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function acceptanceError(error: unknown): QuoteAcceptanceCommandError {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  if (message.includes('QUOTE_EXPIRED')) {
    return new QuoteAcceptanceCommandError(
      'QUOTE_EXPIRED',
      'This quote has expired. Create or send a current revision before accepting it.',
    );
  }
  if (message.toLowerCase().includes('not found')) {
    return new QuoteAcceptanceCommandError(
      'QUOTE_NOT_FOUND',
      'Quote not found',
    );
  }
  return new QuoteAcceptanceCommandError(
    'QUOTE_NOT_ACCEPTABLE',
    message || 'Quote cannot be accepted in its current state',
  );
}

export async function acceptQuoteAndEnsureDepositInvoice(params: {
  quoteVersionUuid: string;
  actor: string | null;
}): Promise<AcceptedQuoteInvoiceCommandResult> {
  const command = await supabaseServiceRole.rpc(
    'commercial_accept_quote_with_project_lock',
    {
      p_quote_version_id: params.quoteVersionUuid,
      p_actor: params.actor,
    },
  );
  if (command.error) throw acceptanceError(command.error);
  const row = firstRow(command.data);
  const invoiceId =
    typeof row?.invoice_id === 'string' ? row.invoice_id : '';
  if (!invoiceId) {
    throw new QuoteAcceptanceCommandError(
      'QUOTE_NOT_ACCEPTABLE',
      'Quote was accepted but its deposit invoice could not be prepared',
    );
  }

  const projectUuid = String(row?.invoice_project_id ?? '');
  const quoteUuid =
    typeof row?.invoice_quote_id === 'string' && row.invoice_quote_id
      ? row.invoice_quote_id
      : null;
  const quoteTotalIncGstCents =
    Number(row?.invoice_quote_total_inc_gst_cents) || 0;
  const quoteVersionUuid =
    typeof row?.quote_version_id === 'string' && row.quote_version_id
      ? row.quote_version_id
      : params.quoteVersionUuid;
  const alreadyAccepted = Boolean(row?.already_accepted);
  const acceptanceOccurredAt = normalizeMarketingConversionOccurredAt(
    row?.invoice_created_at,
  );

  // A recent authoritative replay can repair a crash between the acceptance
  // transaction and this idempotent side effect. Preserve the business time so
  // an old accepted quote can never reappear as a new GA4 conversion.
  try {
    if (
      !alreadyAccepted
      || recentMarketingConversionOccurrence(acceptanceOccurredAt)
    ) {
      await recordMarketingConversionEvent({
        type: 'marketing.quote_accepted',
        projectId: projectUuid,
        primaryId: quoteVersionUuid,
        occurredAt: acceptanceOccurredAt,
        payload: {
          quoteVersionId: quoteVersionUuid,
          ...(quoteUuid ? { quoteId: quoteUuid } : {}),
          valueIncGstCents: quoteTotalIncGstCents,
        },
      });
    }
  } catch (error) {
    console.error('[quote_acceptance] marketing follow-up needs attention', {
      quoteVersionUuid,
      error,
    });
  }

  try {
    await reconcileQuoteOutcomeCadence({
      serviceClient: supabaseServiceRole,
      projectId: projectUuid,
      quoteVersionId: quoteVersionUuid,
      outcome: 'ACCEPTED',
    });
  } catch (error) {
    console.error('[quote_acceptance] work follow-up needs attention', {
      quoteVersionUuid,
      error,
    });
  }
  let sent = false;
  let sendError: string | null = null;
  let deliveryState:
    | 'sent'
    | 'retry_available'
    | 'needs_attention' = 'retry_available';
  try {
    const delivery = await deliverAcceptedDepositInvoiceById({
      invoiceUuid: invoiceId,
      actor: params.actor,
    });
    sent = delivery.sent;
    sendError = delivery.sendError;
    deliveryState = delivery.deliveryState;
  } catch (error) {
    sendError =
      error instanceof Error
        ? error.message
        : 'Deposit invoice was prepared but delivery did not complete';
  }

  return {
    quoteVersionUuid,
    alreadyAccepted,
    invoice: {
      id: invoiceId,
      invoiceRef: String(row?.invoice_ref ?? ''),
      created: Boolean(row?.invoice_created),
      sent,
      sendError,
      deliveryState,
    },
  };
}
