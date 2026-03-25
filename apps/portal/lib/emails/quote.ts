import { renderTemplate } from '@/lib/emails/renderTemplate';
import { sendTransactionalEmail } from '@/lib/emails/sendTransactionalEmail';

export type QuoteReadyEmailInput = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  name: string;
  quote_number: string;
  quote_total_inc_gst: string;
  project_address?: string;
  quote_accept_link: string;
  quote_pdf_link?: string;
  deposit_amount?: string;
  quote_valid_until?: string;
  included_item_1?: string;
  included_item_2?: string;
  included_item_3?: string;
  excluded_item_1?: string;
  excluded_item_2?: string;
  next_step_text?: string;
  personal_note_html?: string;
  logo_url?: string;
  reference_id?: string;
  payment_lines?: string[];
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export async function renderQuoteReadyEmail(input: QuoteReadyEmailInput): Promise<{ html: string; text?: string }> {
  return renderTemplate('quote-ready', input);
}

export async function sendQuoteReadyEmail(input: QuoteReadyEmailInput) {
  const { html, text } = await renderQuoteReadyEmail(input);

  const response = await sendTransactionalEmail({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject ?? `Quote ready - ${input.quote_number}`,
    html,
    text,
    attachments: input.attachments,
  });

  return { response, html, text };
}
