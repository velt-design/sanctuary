import { renderTemplate } from './renderTemplate';
import { sendTransactionalEmail } from './sendTransactionalEmail';

const DEFAULT_CONTACT_EMAIL = 'info@sanctuarypergolas.co.nz';

export type DepositInvoiceEmailInput = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  name: string;
  invoice_number: string;
  project_name?: string;
  invoice_subtotal_ex_gst?: string;
  invoice_gst?: string;
  invoice_total_inc_gst: string;
  source_quote_total_inc_gst?: string;
  quote_number: string;
  deposit_percent: string;
  payment_stage?: string;
  due_date?: string;
  project_address?: string;
  invoice_link: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_reference?: string;
  payment_reference?: string;
  payment_lines?: string[];
  personal_note_html?: string;
  personal_note_text?: string;
  contact_email?: string;
  reference_id?: string;
  attachment_names?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

export async function renderDepositInvoiceEmail(input: DepositInvoiceEmailInput): Promise<{ html: string; text?: string }> {
  const paymentReference = input.payment_reference?.trim() || input.bank_reference?.trim() || input.invoice_number;
  const explicitAttachmentNames = input.attachment_names?.map((name) => name.trim()).filter(Boolean) ?? [];
  const attachmentNames = explicitAttachmentNames.length
    ? explicitAttachmentNames
    : input.attachments?.map((attachment) => attachment.filename.trim()).filter(Boolean);

  return renderTemplate(
    'deposit-invoice-ready',
    {
      ...input,
      payment_stage: input.payment_stage?.trim() || `${input.deposit_percent} initial payment`,
      payment_reference: paymentReference,
      contact_email: input.contact_email?.trim() || DEFAULT_CONTACT_EMAIL,
      attachment_names: attachmentNames?.length ? attachmentNames : undefined,
    },
    { plainTextNoEscape: true }
  );
}

export async function sendDepositInvoiceEmail(input: DepositInvoiceEmailInput) {
  const { html, text } = await renderDepositInvoiceEmail(input);

  const response = await sendTransactionalEmail({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject ?? `${input.payment_stage?.trim() || 'Payment'} invoice - ${input.invoice_number}`,
    html,
    text,
    attachments: input.attachments,
  });

  return { response, html, text };
}
