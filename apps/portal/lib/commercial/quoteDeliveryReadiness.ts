import 'server-only';

import {
  inspectUnfinishedCommercialEmailIntent,
  type CommercialEmailIntent,
} from './emailIntent';

type QuoteDeliveryRecovery = Readonly<{
  mode: 'send' | 'resend';
  status:
    | 'prepared'
    | 'dispatching'
    | 'provider_accepted'
    | 'failed'
    | 'needs_attention';
  canRetry: boolean;
}>;

type QuoteDeliveryReadiness = Readonly<{
  commercialWorkflowReady: boolean;
  unfinishedDelivery: QuoteDeliveryRecovery | null;
}>;

function toQuoteDeliveryRecovery(
  intent: CommercialEmailIntent | null,
  nowMs: number,
): QuoteDeliveryRecovery | null {
  if (!intent || intent.status === 'finalised') return null;
  return {
    mode: intent.kind === 'quote_resend' ? 'resend' : 'send',
    status: intent.status,
    canRetry:
      intent.status !== 'needs_attention' &&
      Date.parse(intent.providerIdempotencyExpiresAt) > nowMs,
  };
}

export async function loadQuoteDeliveryReadiness(
  quoteVersionId: string,
  nowMs = Date.now(),
): Promise<QuoteDeliveryReadiness> {
  const send = await inspectUnfinishedCommercialEmailIntent(
    'quote_send',
    quoteVersionId,
  );
  if (!send.schemaReady) {
    return {
      commercialWorkflowReady: false,
      unfinishedDelivery: null,
    };
  }

  const resend = await inspectUnfinishedCommercialEmailIntent(
    'quote_resend',
    quoteVersionId,
  );
  if (!resend.schemaReady) {
    return {
      commercialWorkflowReady: false,
      unfinishedDelivery: null,
    };
  }

  return {
    commercialWorkflowReady: true,
    unfinishedDelivery: toQuoteDeliveryRecovery(
      send.intent ?? resend.intent,
      nowMs,
    ),
  };
}
