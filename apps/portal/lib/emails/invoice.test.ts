// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { paymentDetailsLines } from '@/lib/payments/paymentDetails';
import { describe, expect, it } from 'vitest';
import { DEPOSIT_INVOICE_EMAIL_VISUAL_FIXTURES } from './invoice.fixtures';
import { renderDepositInvoiceEmail } from './invoice';

describe('deposit invoice email', () => {
  it('renders the authoritative payment details block in html and text', async () => {
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

  it('keeps the payment-ledger hierarchy and facts aligned across html and text', async () => {
    const fixture = DEPOSIT_INVOICE_EMAIL_VISUAL_FIXTURES[0]!;
    const rendered = await renderDepositInvoiceEmail(fixture.input);

    const sharedFacts = [
      fixture.input.invoice_number,
      fixture.input.invoice_total_inc_gst,
      fixture.input.quote_number,
      fixture.input.deposit_percent,
      fixture.input.due_date!,
      fixture.input.project_name!,
      fixture.input.project_address!,
      fixture.input.source_quote_total_inc_gst!,
      fixture.input.invoice_subtotal_ex_gst!,
      fixture.input.invoice_gst!,
      fixture.input.payment_reference!,
      fixture.input.attachment_names![0]!,
      fixture.input.contact_email!,
    ];

    for (const fact of sharedFacts) {
      expect(rendered.html).toContain(fact);
      expect(rendered.text).toContain(fact);
    }

    expect(rendered.html).toContain('Payment summary');
    expect(rendered.html).toContain('Pay by bank transfer');
    expect(rendered.html).toContain('Review invoice');
    expect(rendered.text).toContain('PAYMENT SUMMARY');
    expect(rendered.text).toContain('PAY BY BANK TRANSFER');
    expect(rendered.text).toContain('REVIEW INVOICE');
  });

  it('keeps plain-text links literal and derives safe fallback presentation fields', async () => {
    const rendered = await renderDepositInvoiceEmail({
      to: 'customer@example.invalid',
      name: 'Taylor',
      invoice_number: 'INV-1002',
      invoice_total_inc_gst: '$1,150.00',
      quote_number: 'Q-124 v1',
      deposit_percent: '25%',
      invoice_link: 'https://preview.invalid/invoice/invoice-fixture?token=visual-fixture&source=email',
      bank_account_name: 'legacy account field must not render',
      bank_account_number: 'legacy account number must not render',
      attachments: [
        {
          filename: 'INV-1002.pdf',
          content: Buffer.from('deterministic fixture'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(rendered.text).toContain('https://preview.invalid/invoice/invoice-fixture?token=visual-fixture&source=email');
    expect(rendered.text).not.toContain('&#x3D;');
    expect(rendered.text).toContain('Payment reference: INV-1002');
    expect(rendered.text).toContain('- INV-1002.pdf');
    expect(rendered.html).toContain('INV-1002.pdf');
    expect(rendered.html).toContain('mailto:info@sanctuarypergolas.co.nz');
    expect(rendered.html).not.toContain('legacy account field must not render');
    expect(rendered.html).not.toContain('legacy account number must not render');
  });

  it('does not claim a PDF attachment when none is supplied', async () => {
    const rendered = await renderDepositInvoiceEmail({
      to: 'customer@example.invalid',
      name: 'Taylor',
      invoice_number: 'INV-1003',
      invoice_total_inc_gst: '$575.00',
      quote_number: 'Q-125 v1',
      deposit_percent: '10%',
      invoice_link: 'https://preview.invalid/invoice/invoice-fixture',
    });

    const normalizedHtml = rendered.html.replace(/\s+/g, ' ');
    expect(normalizedHtml).toContain('The online invoice contains');
    expect(normalizedHtml).not.toContain('The attached PDF and online invoice');
    expect(rendered.text).toContain('The online invoice contains');
    expect(rendered.text).not.toContain('The attached PDF and online invoice');
  });

  it('renders deterministic visual fixtures with a fluid square email shell', async () => {
    const outputDir = process.env.INVOICE_EMAIL_ARTIFACT_OUTPUT_DIR?.trim();
    if (outputDir) await mkdir(outputDir, { recursive: true });

    for (const fixture of DEPOSIT_INVOICE_EMAIL_VISUAL_FIXTURES) {
      const rendered = await renderDepositInvoiceEmail(fixture.input);

      expect(rendered.html).toContain('max-width:640px');
      expect(rendered.html).toContain('min-height:48px');
      expect(rendered.html).toContain('@media only screen and (max-width: 660px)');
      expect(rendered.html).not.toContain('border-radius');
      expect(rendered.html).not.toContain('box-shadow');
      expect(rendered.text).toContain('token=visual-fixture&source=email');

      if (outputDir) {
        await writeFile(path.join(outputDir, `${fixture.name}.html`), rendered.html, 'utf8');
        await writeFile(path.join(outputDir, `${fixture.name}.txt`), rendered.text ?? '', 'utf8');
      }
    }
  });
});
