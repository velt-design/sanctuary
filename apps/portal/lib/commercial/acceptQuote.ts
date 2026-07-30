import 'server-only';

import { deliverAcceptedDepositInvoiceById } from '../invoices/server';
import { reconcileQuoteOutcomeCadence } from '../projects/workItems/quoteCadenceReconciliation';
import { supabaseServiceRole } from '../supabaseClient';
import { insertCommercialAuditEvent } from './audit';

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
    'commercial_accept_quote_and_ensure_invoice',
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

  const invoiceLookup = await supabaseServiceRole
    .from('deposit_invoices')
    .select('id, invoice_ref, project_id')
    .eq('id', invoiceId)
    .single();
  if (invoiceLookup.error || !invoiceLookup.data) {
    throw new QuoteAcceptanceCommandError(
      'QUOTE_NOT_ACCEPTABLE',
      invoiceLookup.error?.message ??
        'Accepted quote deposit invoice could not be loaded',
    );
  }

  const projectUuid = String(
    (invoiceLookup.data as any).project_id ?? '',
  );
  await reconcileQuoteOutcomeCadence({
    serviceClient: supabaseServiceRole,
    projectId: projectUuid,
    quoteVersionId: params.quoteVersionUuid,
    outcome: 'ACCEPTED',
  });

  if (!row?.already_accepted) {
    await insertCommercialAuditEvent({
      projectId: projectUuid,
      type: 'quote.accepted',
      idempotencyKey: `quote.accepted:${params.quoteVersionUuid}`,
      payload: { quoteVersionId: params.quoteVersionUuid },
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
    quoteVersionUuid:
      typeof row?.quote_version_id === 'string'
        ? row.quote_version_id
        : params.quoteVersionUuid,
    alreadyAccepted: Boolean(row?.already_accepted),
    invoice: {
      id: invoiceId,
      invoiceRef: String((invoiceLookup.data as any).invoice_ref ?? ''),
      created: Boolean(row?.invoice_created),
      sent,
      sendError,
      deliveryState,
    },
  };
}
