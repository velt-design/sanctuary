import type { EnquiryPayload } from '@/emails/types';
import {
  renderWebsiteAutoresponder,
  websiteAutoresponderTemplateIdFor,
} from '../websiteAutoresponder';
import { sendEmail } from '@/lib/email/sendEmail';

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const BCC_INBOX = 'info@sanctuarypergolas.co.nz';

type AutoresponderAttachment = { filename: string; content: string; contentType?: string };

export async function sendCustomerAutoresponder(
  enquiry: EnquiryPayload,
  options?: {
    attachments?: AutoresponderAttachment[];
    idempotencyKey?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const rendered = await renderWebsiteAutoresponder(
    websiteAutoresponderTemplateIdFor(enquiry.enquiryType),
    { ...enquiry },
  );

  const attachments = options?.attachments?.length ? options.attachments : undefined;

  const result = await sendEmail({
    from: FROM,
    to: enquiry.email,
    bcc: [BCC_INBOX],
    replyTo: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    ...(attachments ? { attachments } : {}),
    ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  return result.providerMessageId;
}
