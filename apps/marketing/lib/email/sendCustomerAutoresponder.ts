import type { EnquiryPayload } from '@/emails/types';
import type { EmailMessageInput } from '@sp/email-provider';
import {
  renderWebsiteAutoresponder,
  websiteAutoresponderTemplateIdFor,
  type WebsiteAutoresponderTemplateId,
} from '../websiteAutoresponder';
import { sendEmail } from '@/lib/email/sendEmail';

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const BCC_INBOX = 'info@sanctuarypergolas.co.nz';

type AutoresponderAttachment = { filename: string; content: string; contentType?: string };

export async function prepareCustomerAutoresponder(
  enquiry: EnquiryPayload,
  options?: {
    templateId?: WebsiteAutoresponderTemplateId;
    attachments?: AutoresponderAttachment[];
  },
): Promise<EmailMessageInput> {
  const rendered = await renderWebsiteAutoresponder(
    options?.templateId ?? websiteAutoresponderTemplateIdFor(enquiry.enquiryType),
    { ...enquiry },
  );

  const attachments = options?.attachments?.length ? options.attachments : undefined;

  return {
    from: FROM,
    to: enquiry.email,
    bcc: [BCC_INBOX],
    replyTo: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    ...(attachments ? { attachments } : {}),
  };
}

export async function sendCustomerAutoresponder(
  enquiry: EnquiryPayload,
  options?: {
    templateId?: WebsiteAutoresponderTemplateId;
    attachments?: AutoresponderAttachment[];
    idempotencyKey?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const message = await prepareCustomerAutoresponder(enquiry, options);
  const result = await sendEmail({
    ...message,
    ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  return result.providerMessageId;
}
