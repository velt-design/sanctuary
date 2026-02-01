import { render } from '@react-email/render';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCallWindowText } from '../src/emails/utils/callWindow';
import type { ResidentialOrCommercial, Professional } from '../src/emails/types';

import { CustomerResidentialEmail } from '../src/emails/templates/customerResidential';
import { CustomerCommercialEmail } from '../src/emails/templates/customerCommercial';
import { CustomerProfessionalEmail } from '../src/emails/templates/customerProfessional';
import { InternalResidentialEmail } from '../src/emails/templates/internalResidential';
import { InternalCommercialEmail } from '../src/emails/templates/internalCommercial';
import { InternalProfessionalEmail } from '../src/emails/templates/internalProfessional';

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

const residentialLead: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'residential',
  widthM: 4.2,
  depthM: 3.6,
  heightM: 2.7,
  style: 'Gable',
  roof: 'Acrylic',
  addons: ['Lighting', 'Heating'],
  blindsSelected: true,
  baseRange: { lowIncGst: 18500, highIncGst: 25500 },
  blindsRange: { lowIncGst: 4200, highIncGst: 6800 },
};

const commercialLead: ResidentialOrCommercial = {
  ...baseLead,
  enquiryType: 'commercial',
  widthM: 8.5,
  depthM: 4.2,
  heightM: 3.2,
  style: 'Hip',
  roof: 'Both',
  addons: ['Lighting', 'Fans'],
  blindsSelected: false,
  baseRange: { lowIncGst: 42000, highIncGst: 62000 },
};

const professionalLead: Professional = {
  ...baseLead,
  enquiryType: 'professional',
  company: 'Studio North Architects',
  filesReceivedCount: 3,
};

const templates = {
  'customer-residential': {
    file: 'customer-residential.html',
    render: () => CustomerResidentialEmail({ ...residentialLead, callWindowText }),
  },
  'customer-commercial': {
    file: 'customer-commercial.html',
    render: () => CustomerCommercialEmail({ ...commercialLead, callWindowText }),
  },
  'customer-professional': {
    file: 'customer-professional.html',
    render: () => CustomerProfessionalEmail({ ...professionalLead, callWindowText }),
  },
  'internal-residential': {
    file: 'internal-residential.html',
    render: () => InternalResidentialEmail({ ...residentialLead, callWindowText }),
  },
  'internal-commercial': {
    file: 'internal-commercial.html',
    render: () => InternalCommercialEmail({ ...commercialLead, callWindowText }),
  },
  'internal-professional': {
    file: 'internal-professional.html',
    render: () => InternalProfessionalEmail({ ...professionalLead, callWindowText }),
  },
};

type TemplateKey = keyof typeof templates;

async function main() {
  const templateKey = (process.argv[2] as TemplateKey | undefined) ?? 'customer-residential';
  const selected = templates[templateKey];

  if (!selected) {
    console.error(`Unknown template: ${process.argv[2]}`);
    console.error('Available templates:');
    Object.keys(templates).forEach((key) => console.error(`- ${key}`));
    process.exitCode = 1;
    return;
  }

  const outputDir = path.join(process.cwd(), 'tmp', 'email-previews');
  await mkdir(outputDir, { recursive: true });

  const html = await render(selected.render());
  const text = await render(selected.render(), { plainText: true });

  const htmlPath = path.join(outputDir, selected.file);
  const textPath = htmlPath.replace(/\.html$/, '.txt');

  await writeFile(htmlPath, html, 'utf8');
  await writeFile(textPath, text, 'utf8');

  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${textPath}`);
}

main().catch((error) => {
  console.error('Email preview failed:', error);
  process.exitCode = 1;
});
