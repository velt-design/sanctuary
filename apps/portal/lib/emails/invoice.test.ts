import { describe, expect, it } from 'vitest';
import { paymentDetailsLines } from '@/lib/payments/paymentDetails';
import { renderDepositInvoiceEmail } from './invoice';

describe('deposit invoice email', () => {
  it('renders the shared payment details block in html and text', async () => {
    const paymentLines = paymentDetailsLines('invoice');
    const rendered = await renderDepositInvoiceEmail({
      to: ['customer@example.com'],
      name: 'Taylor',
      invoice_number: 'INV-1001',
      invoice_total_inc_gst: '$2,875.00',
      quote_number: 'Q-123 v2',
      deposit_percent: '50%',
      due_date: '2 Apr 2026',
      invoice_link: 'https://example.com/invoice/INV-1001',
      payment_lines: paymentLines,
    });

    for (const line of paymentLines) {
      expect(rendered.html).toContain(line);
      expect(rendered.text).toContain(line);
    }
  });
});
