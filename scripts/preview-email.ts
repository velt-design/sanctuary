import { render } from '@react-email/render';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCallWindowText } from '../apps/marketing/emails/utils/callWindow';
import type { ResidentialOrCommercial, Professional } from '../apps/marketing/emails/types';
import {
  getWebsiteAutoresponderPreviewFixture,
  WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS,
  type WebsiteAutoresponderPreviewVariant,
} from '../apps/marketing/lib/websiteAutoresponderPreviewFixtures';
import { renderWebsiteAutoresponder } from '../apps/marketing/lib/websiteAutoresponder';

import { InternalResidentialEmail } from '../apps/marketing/emails/templates/internalResidential';
import { InternalCommercialEmail } from '../apps/marketing/emails/templates/internalCommercial';
import { InternalProfessionalEmail } from '../apps/marketing/emails/templates/internalProfessional';

const now = new Date();
const callWindowText = getCallWindowText(now);

const baseLead = {
  leadId: 'LD-2026-0001',
  submittedAt: now,
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  phone: '021 555 0199',
  suburb: 'Ponsonby',
  message: 'Interested in a pergola with lights and heating.',
  utmSource: 'google',
  utmMedium: 'cpc',
  utmCampaign: 'summer-2026',
  landingUrl: 'https://sanctuarypergolas.co.nz/contact',
} as const;

const residentialWithBlinds: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'residential',
  widthM: 4.2,
  depthM: 3.6,
  heightM: 2.7,
  style: 'Gable',
  roof: 'Acrylic',
  addons: ['Blinds', 'Lighting', 'Heating'],
  blindsSelected: true,
  baseRange: { lowIncGst: 27_500, highIncGst: 27_500 },
  blindsRange: { lowIncGst: 7_500, highIncGst: 8_750 },
};

const commercialNoBlinds: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'commercial',
  widthM: 8.5,
  depthM: 4.2,
  heightM: 3.2,
  style: 'Hip',
  roof: 'Both',
  addons: ['Lighting', 'Fans'],
  blindsSelected: false,
  baseRange: { lowIncGst: 52_500, highIncGst: 52_500 },
};

const professionalLead: Professional = {
  ...baseLead,
  enquiryType: 'professional',
  company: 'Studio North Architects',
  filesReceivedCount: 3,
};

const templates = {
  'internal-residential': {
    file: 'internal-residential.html',
    render: () => InternalResidentialEmail({ ...residentialWithBlinds, callWindowText }),
  },
  'internal-commercial': {
    file: 'internal-commercial.html',
    render: () => InternalCommercialEmail({ ...commercialNoBlinds, callWindowText }),
  },
  'internal-professional': {
    file: 'internal-professional.html',
    render: () => InternalProfessionalEmail({ ...professionalLead, callWindowText }),
  },
};

type TemplateKey = keyof typeof templates;

async function writePreview(outputDir: string, fileName: string, reactEmail: JSX.Element) {
  const html = await render(reactEmail);
  const text = await render(reactEmail, { plainText: true });

  const htmlPath = path.join(outputDir, fileName);
  const textPath = htmlPath.replace(/\.html$/, '.txt');

  await writeFile(htmlPath, html, 'utf8');
  await writeFile(textPath, text, 'utf8');

  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${textPath}`);
}

async function writeWebsitePreview(
  outputDir: string,
  variant: WebsiteAutoresponderPreviewVariant,
) {
  const fixture = getWebsiteAutoresponderPreviewFixture(variant);
  const rendered = await renderWebsiteAutoresponder(
    fixture.templateId,
    fixture.variables as unknown as Record<string, unknown>,
  );
  const htmlPath = path.join(outputDir, `${fixture.fileBaseName}.html`);
  const textPath = path.join(outputDir, `${fixture.fileBaseName}.txt`);

  await writeFile(htmlPath, rendered.html, 'utf8');
  await writeFile(textPath, rendered.text, 'utf8');

  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${textPath}`);
  console.log(`Subject: ${rendered.subject}`);
  console.log(`Preheader: ${rendered.preheader}`);
}

const customerTemplateVariants = Object.fromEntries(
  WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS.map((variant) => {
    const fixture = getWebsiteAutoresponderPreviewFixture(variant);
    return [fixture.fileBaseName, variant];
  }),
) as Record<string, WebsiteAutoresponderPreviewVariant>;

async function main() {
  const arg = (process.argv[2] ?? '').trim();
  const outputDir = path.join(process.cwd(), 'tmp', 'email-previews');
  await mkdir(outputDir, { recursive: true });

  if (arg === 'enquiry-variants') {
    for (const variant of WEBSITE_AUTORESPONDER_PREVIEW_VARIANTS) {
      await writeWebsitePreview(outputDir, variant);
    }
    return;
  }

  const customerVariant =
    customerTemplateVariants[arg || 'customer-residential-pitched-without-blinds'];
  if (customerVariant) {
    await writeWebsitePreview(outputDir, customerVariant);
    return;
  }

  const templateKey =
    (arg as TemplateKey | '') || 'customer-residential-pitched-without-blinds';
  const selected = templates[templateKey as TemplateKey];

  if (!selected) {
    console.error(`Unknown template: ${process.argv[2]}`);
    console.error('Available templates:');
    Object.keys(customerTemplateVariants).forEach((key) => console.error(`- ${key}`));
    Object.keys(templates).forEach((key) => console.error(`- ${key}`));
    console.error('- enquiry-variants');
    process.exitCode = 1;
    return;
  }

  await writePreview(outputDir, selected.file, selected.render());
}

main().catch((error) => {
  console.error('Email preview failed:', error);
  process.exitCode = 1;
});
