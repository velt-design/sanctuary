import { renderTemplate } from '@/lib/emails/renderTemplate';

export type QuoteReadyEmailInput = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  name: string;
  quote_number: string;
  project_name?: string;
  quote_subtotal_ex_gst?: string;
  quote_gst?: string;
  quote_total_inc_gst: string;
  project_address?: string;
  quote_accept_link: string;
  quote_pdf_link?: string;
  deposit_amount?: string;
  quote_valid_until?: string;
  deposit_percent?: string;
  included_item_1?: string;
  included_item_2?: string;
  included_item_3?: string;
  excluded_item_1?: string;
  excluded_item_2?: string;
  next_step_text?: string;
  personal_note_html?: string;
  personal_note_text?: string;
  logo_url?: string;
  reference_id?: string;
  payment_lines?: string[];
  attachment_names?: string[];
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export async function renderQuoteReadyEmail(input: QuoteReadyEmailInput): Promise<{ html: string; text?: string }> {
  return renderTemplate('quote-ready', input, { plainTextNoEscape: true });
}

