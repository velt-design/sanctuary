import type { EnquiryPayload } from '@/emails/types';
import { prepareResendEmailMessage, type EmailEnquiryReference } from '@sp/email-provider';
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
  const prepared = await prepareCustomerAutoresponder(enquiry, options);
  const result = await sendEmail({
    ...prepared.message,
    ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  return result.providerMessageId;
}

export async function prepareCustomerAutoresponder(
  enquiry: EnquiryPayload,
  options?: { attachments?: AutoresponderAttachment[]; enquiryReference?: EmailEnquiryReference },
) {
  const rendered = await renderWebsiteAutoresponder(
    websiteAutoresponderTemplateIdFor(enquiry.enquiryType),
    { ...enquiry },
    { enquiryReference: options?.enquiryReference },
  );

  const attachments = options?.attachments?.length ? options.attachments : undefined;

  return prepareResendEmailMessage({
    from: FROM,
    to: enquiry.email,
    bcc: [BCC_INBOX],
    replyTo: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    ...(attachments ? { attachments } : {}),
    ...(options?.enquiryReference ? { enquiryReference: options.enquiryReference } : {}),
  });
}
