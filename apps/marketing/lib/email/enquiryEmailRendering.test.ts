import { describe, expect, it } from 'vitest';
import { parseEmailEnquiryReference } from '@sp/email-provider';
import { renderWebsiteAutoresponder, EMAIL_WEBSITE_AUTORESPONDER_RES_V1 } from '../websiteAutoresponder';

describe('active enquiry reference rendering', () => {
  it('renders the same opaque reference in HTML and plaintext and stored preview variables', async () => {
    const enquiryReference = parseEmailEnquiryReference('sp_enq_11111111-1111-4111-8111-111111111111');
    const variables = { name: 'Taylor', enquiryType: 'residential', email: 'taylor@example.test', enquiryReference };
    const result = await renderWebsiteAutoresponder(EMAIL_WEBSITE_AUTORESPONDER_RES_V1, variables);
    expect(result.html).toContain(enquiryReference);
    expect(result.text).toContain(`Enquiry reference: ${enquiryReference}`);
    expect(result.subject).not.toContain(enquiryReference);
    const without = await renderWebsiteAutoresponder(EMAIL_WEBSITE_AUTORESPONDER_RES_V1, { name: 'Taylor' });
    expect(without.text).not.toContain('Enquiry reference:');
  });
});
