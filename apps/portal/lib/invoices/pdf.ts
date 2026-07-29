import 'server-only';

import type { DepositInvoiceArtifactInput } from './invoiceArtifactViewModel';
import { renderDepositInvoicePdfDocument } from './invoicePdfDocument';
import type { DepositInvoicePdfLayout } from './invoicePdfLayout';

export type DepositInvoicePdfData = DepositInvoiceArtifactInput;

export function depositInvoicePdfFilename(invoiceRef: string): string {
  return `${invoiceRef}.pdf`;
}

export async function generateDepositInvoicePdfBytes(
  data: DepositInvoicePdfData,
  options: { paymentLines?: readonly string[] } = {}
): Promise<Uint8Array> {
  const { bytes } = await renderDepositInvoicePdfDocument(data, options);
  return bytes;
}

export async function generateDepositInvoicePdfBytesWithLayout(
  data: DepositInvoicePdfData,
  options: { paymentLines?: readonly string[] } = {}
): Promise<{
  bytes: Uint8Array;
  layout: DepositInvoicePdfLayout;
}> {
  return renderDepositInvoicePdfDocument(data, {
    collectLayout: true,
    paymentLines: options.paymentLines,
  });
}
