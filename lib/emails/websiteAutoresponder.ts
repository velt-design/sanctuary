import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { getCallWindowText } from '../../apps/marketing/emails/utils/callWindow';

import { CustomerResidentialEmail } from '../../apps/marketing/emails/templates/customerResidential';
import { CustomerCommercialEmail } from '../../apps/marketing/emails/templates/customerCommercial';
import { CustomerProfessionalEmail } from '../../apps/marketing/emails/templates/customerProfessional';

export const EMAIL_WEBSITE_AUTORESPONDER_RES_V1 = 'EMAIL_WEBSITE_AUTORESPONDER_RES_V1' as const;
export const EMAIL_WEBSITE_AUTORESPONDER_COM_V1 = 'EMAIL_WEBSITE_AUTORESPONDER_COM_V1' as const;
export const EMAIL_WEBSITE_AUTORESPONDER_PRO_V1 = 'EMAIL_WEBSITE_AUTORESPONDER_PRO_V1' as const;

export type WebsiteAutoresponderTemplateId =
  | typeof EMAIL_WEBSITE_AUTORESPONDER_RES_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_COM_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_PRO_V1;

export function isWebsiteAutoresponderTemplateId(value: string): value is WebsiteAutoresponderTemplateId {
  return (
    value === EMAIL_WEBSITE_AUTORESPONDER_RES_V1 ||
    value === EMAIL_WEBSITE_AUTORESPONDER_COM_V1 ||
    value === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
  );
}

function subjectFor(templateId: WebsiteAutoresponderTemplateId): string {
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_COM_V1) return 'Commercial enquiry received - estimate and next steps';
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1) return 'Professional enquiry received - next steps';
  return 'Your pergola enquiry - estimate and next steps';
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

export async function renderWebsiteAutoresponder(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
) {
  const submittedAt = asDate(variables.submittedAt) ?? new Date();
  const callWindowText =
    typeof variables.callWindowText === 'string' && variables.callWindowText.trim()
      ? variables.callWindowText.trim()
      : getCallWindowText(submittedAt);

  const subject = subjectFor(templateId);

  let reactEmail: ReactElement;
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_RES_V1) {
    reactEmail = CustomerResidentialEmail({ ...(variables as any), callWindowText } as any);
  } else if (templateId === EMAIL_WEBSITE_AUTORESPONDER_COM_V1) {
    reactEmail = CustomerCommercialEmail({ ...(variables as any), callWindowText } as any);
  } else {
    reactEmail = CustomerProfessionalEmail({ ...(variables as any), callWindowText } as any);
  }

  const html = await render(reactEmail);
  const text = await render(reactEmail, { plainText: true });
  return { subject, html, text };
}
