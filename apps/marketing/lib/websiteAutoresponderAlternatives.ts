import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { CompactEmail } from '../emails/alternatives/CompactEmail';
import { EditorialRefinedEmail } from '../emails/alternatives/EditorialRefinedEmail';
import { ImageLedEmail } from '../emails/alternatives/ImageLedEmail';
import {
  buildAlternativeEmailModel,
} from '../emails/alternatives/alternativeEmailModel';
import type { AlternativePreviewTheme } from '../emails/alternatives/AlternativeEmailShell';
import {
  PROFESSIONAL_ENQUIRY_PREHEADER,
  customerEstimatePreheader,
} from '../emails/customerAutoresponderCopy';
import {
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  type WebsiteAutoresponderTemplateId,
  websiteAutoresponderSubject,
} from './websiteAutoresponder';

export const WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS = [
  {
    id: 'editorial-refined',
    name: 'Editorial Refined',
    description:
      'A polished evolution of the current email with calmer pacing, stronger reassurance and a clearer reading sequence.',
    bestFor:
      'Balanced brand expression and the safest path to a final production template.',
  },
  {
    id: 'image-led',
    name: 'Image-led',
    description:
      'Project photography leads the story, followed by a high-contrast introduction and quick project facts.',
    bestFor:
      'Emotional impact and showing the quality of completed Sanctuary work.',
  },
  {
    id: 'compact',
    name: 'Compact',
    description:
      'A denser two-column desktop composition that keeps the estimate, next steps and submitted brief close together.',
    bestFor:
      'Fast scanning, repeat enquiries and readers who want the essential information quickly.',
  },
] as const;

export type WebsiteAutoresponderPreviewLayout =
  (typeof WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS)[number]['id'];

const layoutIds = new Set<string>(
  WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS.map((layout) => layout.id),
);

export function isWebsiteAutoresponderPreviewLayout(
  value: unknown,
): value is WebsiteAutoresponderPreviewLayout {
  return typeof value === 'string' && layoutIds.has(value);
}

function moneyRange(value: unknown): {
  lowIncGst: number;
  highIncGst: number;
} {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const lowIncGst = Number(record.lowIncGst);
    const highIncGst = Number(record.highIncGst);
    if (Number.isFinite(lowIncGst) && Number.isFinite(highIncGst)) {
      return { lowIncGst, highIncGst };
    }
  }
  return { lowIncGst: 0, highIncGst: 0 };
}

function preheaderFor(
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
    moneyRange(variables.baseRange),
  );
}

function alternativeEmail(
  layout: WebsiteAutoresponderPreviewLayout,
  props: {
    model: ReturnType<typeof buildAlternativeEmailModel>;
    preheader: string;
    previewTheme?: AlternativePreviewTheme;
  },
): ReactElement {
  if (layout === 'image-led') return ImageLedEmail(props);
  if (layout === 'compact') return CompactEmail(props);
  return EditorialRefinedEmail(props);
}

function websiteAutoresponderPreviewSendSubject(
  layout: WebsiteAutoresponderPreviewLayout,
  customerSubject: string,
): string {
  const name =
    WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS.find(
      (candidate) => candidate.id === layout,
    )?.name ?? layout;
  return `[Preview: ${name}] ${customerSubject}`;
}

export async function renderWebsiteAutoresponderAlternative(
  templateId: WebsiteAutoresponderTemplateId,
  variables: Record<string, unknown>,
  layout: WebsiteAutoresponderPreviewLayout,
  options: { previewTheme?: AlternativePreviewTheme } = {},
) {
  const subject = websiteAutoresponderSubject(templateId, variables);
  const preheader = preheaderFor(templateId, variables);
  const model = buildAlternativeEmailModel(templateId, variables);
  const reactEmail = alternativeEmail(layout, {
    model,
    preheader,
    previewTheme: options.previewTheme,
  });
  const html = await render(reactEmail);
  const text = await render(reactEmail, { plainText: true });
  return {
    layout,
    subject,
    sendSubject: websiteAutoresponderPreviewSendSubject(layout, subject),
    preheader,
    hero: model.hero,
    html,
    text,
  };
}
