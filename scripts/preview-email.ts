import { render } from '@react-email/render';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toIndicativeRangeOneSided } from '../lib/pricing/enquiryEstimate';
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

const residentialBaseRange = toIndicativeRangeOneSided(22000, 'residential');
const residentialBlindsRange = toIndicativeRangeOneSided(6000, 'residential');
const commercialBaseRange = toIndicativeRangeOneSided(42000, 'commercial');
const commercialBlindsRange = toIndicativeRangeOneSided(12800, 'commercial');

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
  baseRange: residentialBaseRange,
  blindsRange: residentialBlindsRange,
};

const residentialNoBlinds: ResidentialOrCommercial = {
  ...residentialWithBlinds,
  addons: ['Lighting', 'Heating'],
  blindsSelected: false,
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
  baseRange: commercialBaseRange,
};

const commercialWithBlinds: ResidentialOrCommercial = {
  ...commercialNoBlinds,
  addons: ['Blinds', 'Lighting', 'Fans'],
  blindsSelected: true,
  blindsRange: commercialBlindsRange,
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
    render: () => CustomerResidentialEmail({ ...residentialWithBlinds, callWindowText }),
  },
  'customer-residential-no-blinds': {
    file: 'customer-residential-no-blinds.html',
    render: () => CustomerResidentialEmail({ ...residentialNoBlinds, callWindowText }),
  },
  'customer-commercial': {
    file: 'customer-commercial.html',
    render: () => CustomerCommercialEmail({ ...commercialNoBlinds, callWindowText }),
  },
  'customer-commercial-with-blinds': {
    file: 'customer-commercial-with-blinds.html',
    render: () => CustomerCommercialEmail({ ...commercialWithBlinds, callWindowText }),
  },
  'customer-professional': {
    file: 'customer-professional.html',
    render: () => CustomerProfessionalEmail({ ...professionalLead, callWindowText }),
  },
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

async function main() {
  const arg = (process.argv[2] ?? '').trim();
  const outputDir = path.join(process.cwd(), 'tmp', 'email-previews');
  await mkdir(outputDir, { recursive: true });

  if (arg === 'enquiry-variants') {
    const keys: TemplateKey[] = [
      'customer-residential',
      'customer-residential-no-blinds',
      'customer-commercial-with-blinds',
      'customer-commercial',
    ];

    for (const key of keys) {
      const selected = templates[key];
      await writePreview(outputDir, selected.file, selected.render());
    }
    return;
  }

  const templateKey = (arg as TemplateKey | '') || 'customer-residential';
  const selected = templates[templateKey as TemplateKey];

  if (!selected) {
    console.error(`Unknown template: ${process.argv[2]}`);
    console.error('Available templates:');
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
