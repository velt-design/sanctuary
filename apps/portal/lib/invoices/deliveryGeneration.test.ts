import { expect, it } from 'vitest';
import { invoiceDeliveryIntentKey, isCurrentInvoiceDelivery } from './deliveryGeneration';
it('retains legacy send identity and creates one stable identity per restoration', () => {
  expect(invoiceDeliveryIntentKey({ id: 'invoice', restore_command_id: null })).toBe('deposit-invoice-send:invoice');
  expect(invoiceDeliveryIntentKey({ id: 'invoice', restore_command_id: 'command' })).toBe(
    'deposit-invoice-send:invoice:restore:command',
  );
});
it('accepts only the matching restored intent, while retaining legacy logs', () => {
  expect(isCurrentInvoiceDelivery('restore', 'current', 'old')).toBe(false);
  expect(isCurrentInvoiceDelivery('restore', null, 'old')).toBe(false);
  expect(isCurrentInvoiceDelivery('restore', 'current', null)).toBe(false);
  expect(isCurrentInvoiceDelivery('restore', 'current', 'current')).toBe(true);
  expect(isCurrentInvoiceDelivery(null, null, null)).toBe(true);
});
