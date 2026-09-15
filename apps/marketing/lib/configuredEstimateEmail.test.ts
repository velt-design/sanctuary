import { expect, it } from 'vitest';
import { renderWebsiteAutoresponder } from './websiteAutoresponder';

const variables = {
  name: 'TEST Sanctuary', email: 'jordan@sanctuarypergolas.co.nz', enquiryType: 'residential',
  customerBrief: { summary: '6 × 3 m pergola with lighting' },
  configuredEstimate: { amountIncGst: 13500, includesGst: true, currency: 'NZD', breakdown: [
    { label: 'Pergola, roof & ceiling', amountIncGst: 12000 },
    { label: 'Lighting', amountIncGst: 1500 },
  ] },
};

it.each(['EMAIL_WEBSITE_ENQUIRY_configured_V2', 'EMAIL_WEBSITE_AUTORESPONDER_RES_V1'] as const)(
  'preserves submitted prices in HTML and plain text for %s', async template => {
    const rendered = await renderWebsiteAutoresponder(template, variables);
    for (const content of [rendered.html, rendered.text]) {
      expect(content).toContain('$13,500');
      expect(content).toContain('$12,000');
      expect(content).toContain('Lighting');
      expect(content).toContain('$1,500');
      expect(content).toContain('including GST');
    }
  },
);
