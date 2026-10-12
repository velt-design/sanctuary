/** An explicit send after restoration is a new intent; earlier delivery evidence stays historical. */
export function invoiceDeliveryIntentKey(invoice: { id: string; restore_command_id: string | null }) {
  return `deposit-invoice-send:${invoice.id}${invoice.restore_command_id ? `:restore:${invoice.restore_command_id}` : ''}`;
}

export function isCurrentInvoiceDelivery(restoreCommandId: string | null, currentIntentId: string | null, logIntentId: string | null) {
  return !restoreCommandId || Boolean(currentIntentId && currentIntentId === logIntentId);
}
