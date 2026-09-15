import type { BackgroundJobJsonObject } from './workerContracts';

export type XeroInvoiceJobPayloadV1 = Readonly<{
  contractVersion: 1;
  transferId: string;
  invoiceId: string;
  tenantId: string;
}>;

/** Protected payload is identity only; the finance owner supplies issued evidence. */
export function parseXeroInvoiceJobPayloadV1(payload: BackgroundJobJsonObject): XeroInvoiceJobPayloadV1 {
  const keys = ['contractVersion', 'invoiceId', 'tenantId', 'transferId'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).sort().join(',') !== keys.join(',') || payload.contractVersion !== 1) {
    throw new TypeError('Invalid Xero invoice job payload');
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const field of ['transferId', 'invoiceId', 'tenantId'] as const) {
    if (typeof payload[field] !== 'string' || !uuid.test(payload[field])) throw new TypeError('Invalid Xero invoice job identity');
  }
  return payload as XeroInvoiceJobPayloadV1;
}
