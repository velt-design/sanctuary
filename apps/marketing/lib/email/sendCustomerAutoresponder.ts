import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { getCallWindowText } from '@/emails/utils/callWindow';
import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '@/emails/types';
import { customerEstimateSubject } from '@/lib/sharedEmails';
import { sendEmail } from '@/lib/email/sendEmail';

import { CustomerResidentialEmail } from '@/emails/templates/customerResidential';
import { CustomerCommercialEmail } from '@/emails/templates/customerCommercial';
import { CustomerProfessionalEmail } from '@/emails/templates/customerProfessional';

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const BCC_INBOX = 'info@sanctuarypergolas.co.nz';

function buildCustomerEmail(enquiry: EnquiryPayload, callWindowText: string): {
  subject: string;
  emailElement: ReactElement;
} {
  if (enquiry.enquiryType === 'residential') {
    return {
      subject: customerEstimateSubject(enquiry.name, 'residential'),
      emailElement: CustomerResidentialEmail({
        ...(enquiry as ResidentialOrCommercial),
        callWindowText,
      }),
    };
  }

  if (enquiry.enquiryType === 'commercial') {
    return {
      subject: customerEstimateSubject(enquiry.name, 'commercial'),
      emailElement: CustomerCommercialEmail({
        ...(enquiry as ResidentialOrCommercial),
        callWindowText,
      }),
    };
  }

  return {
    subject: 'Professional enquiry received - next steps',
    emailElement: CustomerProfessionalEmail({
      ...(enquiry as Professional),
      callWindowText,
    }),
  };
}

type AutoresponderAttachment = { filename: string; content: string; contentType?: string };

export async function sendCustomerAutoresponder(
  enquiry: EnquiryPayload,
  options?: {
    attachments?: AutoresponderAttachment[];
    idempotencyKey?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const callWindowText = getCallWindowText(enquiry.submittedAt);
  const { subject, emailElement } = buildCustomerEmail(enquiry, callWindowText);

  const html = await render(emailElement);
  const text = await render(emailElement, { plainText: true });

  const attachments = options?.attachments?.length ? options.attachments : undefined;

  const result = await sendEmail({
    from: FROM,
    to: enquiry.email,
    bcc: [BCC_INBOX],
    replyTo: REPLY_TO,
    subject,
    html,
    text,
    ...(attachments ? { attachments } : {}),
    ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  return result.providerMessageId;
}
