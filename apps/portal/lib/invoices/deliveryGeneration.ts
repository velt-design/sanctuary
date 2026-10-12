/** An explicit send after restoration is a new intent; earlier delivery evidence stays historical. */
export function invoiceDeliveryIntentKey(invoice: { id: string; restore_command_id: string | null }) {
  return `deposit-invoice-send:${invoice.id}${invoice.restore_command_id ? `:restore:${invoice.restore_command_id}` : ''}`;
}

export function isCurrentInvoiceDelivery(restoredAt: string | null, createdAt: string) {
  return !restoredAt || Date.parse(createdAt) >= Date.parse(restoredAt);
}
