import { Resend } from 'resend';
import { render } from '@react-email/render';
import { getCallWindowText } from '@/src/emails/utils/callWindow';
import type { EnquiryPayload, ResidentialOrCommercial, Professional } from '@/src/emails/types';

import { CustomerResidentialEmail } from '@/src/emails/templates/customerResidential';
import { CustomerCommercialEmail } from '@/src/emails/templates/customerCommercial';
import { CustomerProfessionalEmail } from '@/src/emails/templates/customerProfessional';

import { InternalResidentialEmail } from '@/src/emails/templates/internalResidential';
import { InternalCommercialEmail } from '@/src/emails/templates/internalCommercial';
import { InternalProfessionalEmail } from '@/src/emails/templates/internalProfessional';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO = 'info@sanctuarypergolas.co.nz';
const INTERNAL_TO = 'info@sanctuarypergolas.co.nz';

export async function sendEnquiryEmails(enquiry: EnquiryPayload) {
  const callWindowText = getCallWindowText(enquiry.submittedAt);

  let customerSubject = "We've received your enquiry - Sanctuary Pergolas";
  let customerReact: JSX.Element;

  if (enquiry.enquiryType === 'residential') {
    customerSubject = 'Your pergola enquiry - estimate and next steps';
    customerReact = CustomerResidentialEmail({
      ...(enquiry as ResidentialOrCommercial),
      callWindowText,
    });
  } else if (enquiry.enquiryType === 'commercial') {
    customerSubject = 'Commercial enquiry received - estimate and next steps';
    customerReact = CustomerCommercialEmail({
      ...(enquiry as ResidentialOrCommercial),
      callWindowText,
    });
  } else {
    customerSubject = 'Professional enquiry received - next steps';
    customerReact = CustomerProfessionalEmail({
      ...(enquiry as Professional),
      callWindowText,
    });
  }

  const customerHtml = render(customerReact);
  const customerText = render(customerReact, { plainText: true });

  await resend.emails.send({
    from: FROM,
    to: enquiry.email,
    replyTo: REPLY_TO,
    subject: customerSubject,
    html: customerHtml,
    text: customerText,
  });

  if (enquiry.enquiryType === 'residential') {
    const internalReact = InternalResidentialEmail({
      ...(enquiry as ResidentialOrCommercial),
      callWindowText,
    });

    await sendInternal(internalReact, {
      subject: `[NEW LEAD][RES] ${enquiry.suburb} | ${enquiry.name} | ${enquiry.phone} | ID ${enquiry.leadId}`,
    });
  } else if (enquiry.enquiryType === 'commercial') {
    const internalReact = InternalCommercialEmail({
      ...(enquiry as ResidentialOrCommercial),
      callWindowText,
    });

    await sendInternal(internalReact, {
      subject: `[NEW LEAD][COM] ${enquiry.suburb} | ${enquiry.name} | ${enquiry.phone} | ID ${enquiry.leadId}`,
    });
  } else {
    const internalReact = InternalProfessionalEmail({
      ...(enquiry as Professional),
      callWindowText,
    });

    await sendInternal(internalReact, {
      subject: `[NEW LEAD][PRO] ${enquiry.suburb} | ${enquiry.name} | ${enquiry.phone} | ID ${enquiry.leadId}`,
    });
  }
}

async function sendInternal(reactEmail: JSX.Element, options: { subject: string }) {
  const internalHtml = render(reactEmail);
  const internalText = render(reactEmail, { plainText: true });

  await resend.emails.send({
    from: FROM,
    to: INTERNAL_TO,
    replyTo: REPLY_TO,
    subject: options.subject,
    html: internalHtml,
    text: internalText,
  });
}
