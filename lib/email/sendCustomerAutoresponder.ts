import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { getCallWindowText } from '../../src/emails/utils/callWindow';
import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '../../src/emails/types';

import { CustomerResidentialEmail } from '../../src/emails/templates/customerResidential';
import { CustomerCommercialEmail } from '../../src/emails/templates/customerCommercial';
import { CustomerProfessionalEmail } from '../../src/emails/templates/customerProfessional';

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const BCC_INBOX = 'info@sanctuarypergolas.co.nz';

function buildCustomerEmail(enquiry: EnquiryPayload, callWindowText: string): {
  subject: string;
  emailElement: ReactElement;
} {
  if (enquiry.enquiryType === 'residential') {
    return {
      subject: 'Your pergola enquiry - estimate and next steps',
      emailElement: CustomerResidentialEmail({
        ...(enquiry as ResidentialOrCommercial),
        callWindowText,
      }),
    };
  }

  if (enquiry.enquiryType === 'commercial') {
    return {
      subject: 'Commercial enquiry received - estimate and next steps',
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
