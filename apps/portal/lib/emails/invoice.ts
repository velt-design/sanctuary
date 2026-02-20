import { renderTemplate } from './renderTemplate';
import { sendTransactionalEmail } from './sendTransactionalEmail';

export type DepositInvoiceEmailInput = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  name: string;
  invoice_number: string;
  invoice_total_inc_gst: string;
  quote_number: string;
  deposit_percent: string;
  due_date?: string;
  project_address?: string;
  invoice_link: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_reference?: string;
  personal_note_html?: string;
  reference_id?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export async function renderDepositInvoiceEmail(input: DepositInvoiceEmailInput): Promise<{ html: string; text?: string }> {
  return renderTemplate('deposit-invoice-ready', input);
}

export async function sendDepositInvoiceEmail(input: DepositInvoiceEmailInput) {
  const { html, text } = await renderDepositInvoiceEmail(input);

  const response = await sendTransactionalEmail({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject ?? `Deposit invoice - ${input.invoice_number}`,
    html,
    text,
    attachments: input.attachments,
  });

  return { response, html, text };
}
