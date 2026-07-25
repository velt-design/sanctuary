import {
  PROFESSIONAL_ENQUIRY_PREHEADER,
  customerEstimatePreheader,
  customerEstimateSubject,
  professionalEnquirySubject,
} from '../emails/customerAutoresponderCopy';

export const EMAIL_WEBSITE_AUTORESPONDER_RES_V1 =
  'EMAIL_WEBSITE_AUTORESPONDER_RES_V1' as const;
export const EMAIL_WEBSITE_AUTORESPONDER_COM_V1 =
  'EMAIL_WEBSITE_AUTORESPONDER_COM_V1' as const;
export const EMAIL_WEBSITE_AUTORESPONDER_PRO_V1 =
  'EMAIL_WEBSITE_AUTORESPONDER_PRO_V1' as const;

export type WebsiteAutoresponderTemplateId =
  | typeof EMAIL_WEBSITE_AUTORESPONDER_RES_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_COM_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_PRO_V1;

export function isWebsiteAutoresponderTemplateId(
  value: string,
): value is WebsiteAutoresponderTemplateId {
  return (
    value === EMAIL_WEBSITE_AUTORESPONDER_RES_V1 ||
    value === EMAIL_WEBSITE_AUTORESPONDER_COM_V1 ||
    value === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
  );
}

export function websiteAutoresponderTemplateIdFor(
  enquiryType: 'residential' | 'commercial' | 'professional',
): WebsiteAutoresponderTemplateId {
  if (enquiryType === 'commercial') return EMAIL_WEBSITE_AUTORESPONDER_COM_V1;
  if (enquiryType === 'professional') return EMAIL_WEBSITE_AUTORESPONDER_PRO_V1;
  return EMAIL_WEBSITE_AUTORESPONDER_RES_V1;
}

export function websiteAutoresponderSubject(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): string {
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_COM_V1) {
    return customerEstimateSubject(variables.name, 'commercial');
  }
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1) {
    return professionalEnquirySubject(variables.name);
  }
  return customerEstimateSubject(variables.name, 'residential');
}

function asMoneyRange(value: unknown): {
  lowIncGst: number;
  highIncGst: number;
} {
  if (value && typeof value === 'object') {
    const lowIncGst = Number((value as Record<string, unknown>).lowIncGst);
    const highIncGst = Number((value as Record<string, unknown>).highIncGst);
    if (Number.isFinite(lowIncGst) && Number.isFinite(highIncGst)) {
      return { lowIncGst, highIncGst };
    }
  }
  return { lowIncGst: 0, highIncGst: 0 };
}

export function websiteAutoresponderPreheader(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): string {
  if (templateId === EMAIL_WEBSITE_AUTORESPONDER_PRO_V1) {
    return PROFESSIONAL_ENQUIRY_PREHEADER;
  }
  return customerEstimatePreheader(
    templateId === EMAIL_WEBSITE_AUTORESPONDER_COM_V1
      ? 'commercial'
      : 'residential',
    asMoneyRange(variables.baseRange),
  );
}

export { customerEstimateSubject, professionalEnquirySubject };
