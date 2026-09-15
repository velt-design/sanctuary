import type { BackgroundJobHandlerRegistry } from '../runtime/contracts';

import { aiSyntheticHandler } from './aiSynthetic';
import { createXeroInvoiceHandler } from './xeroInvoice';
import { loadXeroInvoiceGatewayConfig } from '../config';

const xeroGateway = loadXeroInvoiceGatewayConfig();

/**
 * The synthetic AI handler has no network, provider, business mutation, or
 * external-effect capability. Xero requires a separate explicit gateway gate.
 */
export const backgroundJobHandlers: BackgroundJobHandlerRegistry = Object.freeze({
  ai_synthetic_v1: aiSyntheticHandler,
  ...(xeroGateway ? { xero_invoice_draft_v1: createXeroInvoiceHandler(xeroGateway) } : {}),
});
