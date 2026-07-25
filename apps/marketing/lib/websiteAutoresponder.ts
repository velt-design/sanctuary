import { render } from '@react-email/render';
import { EditorialRefinedEmail } from '../emails/alternatives/EditorialRefinedEmail';
import { buildAlternativeEmailModel } from '../emails/alternatives/alternativeEmailModel';
import {
  type WebsiteAutoresponderTemplateId,
  websiteAutoresponderPreheader,
  websiteAutoresponderSubject,
} from './websiteAutoresponderContract';

export {
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
  customerEstimateSubject,
  isWebsiteAutoresponderTemplateId,
  professionalEnquirySubject,
  type WebsiteAutoresponderTemplateId,
  websiteAutoresponderSubject,
  websiteAutoresponderTemplateIdFor,
} from './websiteAutoresponderContract';

export async function renderWebsiteAutoresponder(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
) {
  const subject = websiteAutoresponderSubject(templateId, variables);
  const preheader = websiteAutoresponderPreheader(templateId, variables);
  const reactEmail = EditorialRefinedEmail({
    model: buildAlternativeEmailModel(templateId, variables),
    preheader,
  });

  const html = await render(reactEmail);
  const text = await render(reactEmail, { plainText: true });
  return { subject, preheader, html, text };
}
