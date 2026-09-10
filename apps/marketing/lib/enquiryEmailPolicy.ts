import type { CustomerBrief, EnquiryAudience } from './enquiryDesign';
import type { EnquiryExperienceTemplateId } from './enquiryExperience';
import { websiteAutoresponderTemplateIdFor } from './websiteAutoresponderContract';
export function selectEnquiryEmailTemplate(audience: EnquiryAudience, brief: CustomerBrief) {
  // Preview opt-in only. A production release must explicitly activate reviewed copy.
  const enabled = process.env.WEBSITE_ENQUIRY_EXPERIENCE_V2 === 'true'
    || (process.env.WEBSITE_ENQUIRY_EXPERIENCE_V2 !== 'false' && process.env.VERCEL_ENV === 'preview');
  if (!enabled) return websiteAutoresponderTemplateIdFor(audience);
  const experience = audience === 'residential' ? brief.designStatus : audience;
  return `EMAIL_WEBSITE_ENQUIRY_${experience}_V2` as EnquiryExperienceTemplateId;
}
