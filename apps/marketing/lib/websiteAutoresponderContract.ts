import { ENQUIRY_EXPERIENCES, experienceFromTemplate, type EnquiryExperienceTemplateId } from './enquiryExperience';
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
  | EnquiryExperienceTemplateId
  | typeof EMAIL_WEBSITE_AUTORESPONDER_RES_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_COM_V1
  | typeof EMAIL_WEBSITE_AUTORESPONDER_PRO_V1;

export function isWebsiteAutoresponderTemplateId(
  value: string,
): value is WebsiteAutoresponderTemplateId {
  return (
    experienceFromTemplate(value) !== null ||
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
  const experience = experienceFromTemplate(templateId);
  if (experience) return ENQUIRY_EXPERIENCES[experience].subject;
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
} | undefined {
  if (value && typeof value === 'object') {
    const lowIncGst = Number((value as Record<string, unknown>).lowIncGst);
    const highIncGst = Number((value as Record<string, unknown>).highIncGst);
    if (Number.isFinite(lowIncGst) && Number.isFinite(highIncGst)) {
      return { lowIncGst, highIncGst };
    }
  }
  return undefined;
}

export function websiteAutoresponderPreheader(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
): string {
  const experience = experienceFromTemplate(templateId);
  if (experience) return ENQUIRY_EXPERIENCES[experience].preheader;
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
