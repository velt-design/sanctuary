import { expect, it } from 'vitest';
import { invoiceDeliveryIntentKey, isCurrentInvoiceDelivery } from './deliveryGeneration';
it('retains legacy send identity and creates one stable identity per restoration', () => {
  expect(invoiceDeliveryIntentKey({ id: 'invoice', restore_command_id: null })).toBe('deposit-invoice-send:invoice');
  expect(invoiceDeliveryIntentKey({ id: 'invoice', restore_command_id: 'command' })).toBe(
    'deposit-invoice-send:invoice:restore:command',
  );
});
it('does not mistake an old successful delivery for delivery of a restored invoice', () => {
  expect(isCurrentInvoiceDelivery('2026-10-12T00:00:00Z', '2026-10-11T00:00:00Z')).toBe(false);
  expect(isCurrentInvoiceDelivery('2026-10-12T00:00:00Z', '2026-10-12T00:00:01Z')).toBe(true);
  expect(isCurrentInvoiceDelivery(null, '2026-10-11T00:00:00Z')).toBe(true);
});
