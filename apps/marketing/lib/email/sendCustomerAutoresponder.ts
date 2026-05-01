import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { getCallWindowText } from '@/emails/utils/callWindow';
import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '@/emails/types';
import { customerEstimateSubject } from '@/lib/sharedEmails';

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

export async function sendCustomerAutoresponder(enquiry: EnquiryPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);
  const callWindowText = getCallWindowText(enquiry.submittedAt);
  const { subject, emailElement } = buildCustomerEmail(enquiry, callWindowText);

  const html = await render(emailElement);
  const text = await render(emailElement, { plainText: true });

  await resend.emails.send({
    from: FROM,
    to: enquiry.email,
    bcc: [BCC_INBOX],
    replyTo: REPLY_TO,
    subject,
    html,
    text,
  });
}
