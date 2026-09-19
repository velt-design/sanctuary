import { describe, expect, it } from 'vitest';
import { renderWebsiteAutoresponder } from '../lib/websiteAutoresponder';
import { enquiryExperienceFixtures } from '../lib/enquiryExperienceFixtures';
import { getWebsiteAutoresponderPreviewFixture } from '../lib/websiteAutoresponderPreviewFixtures';

describe('customer enquiry email clarity', () => {
  it('retains frozen pricing and design access when the older template receives a configured enquiry', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture('experience-configured');
    const variables = { ...fixture.variables, configuredEstimate: { amountIncGst: 13500, includesGst: true, currency: 'NZD', breakdown: [{ label: 'Pergola', amountIncGst: 12000 }, { label: 'Lighting', amountIncGst: 1500 }] } };
    const rendered = await renderWebsiteAutoresponder('EMAIL_WEBSITE_AUTORESPONDER_RES_V1', variables);
    expect(rendered.text).toContain('$13,500');
    expect(rendered.text).toContain('Lighting');
    expect(rendered.html).toContain('configurator-preview?open=1#design=');
    expect(rendered.text).toContain('Later changes won’t update this enquiry');
    expect(rendered.text).not.toContain(fixture.variables.message);
    const withoutPrice = await renderWebsiteAutoresponder('EMAIL_WEBSITE_AUTORESPONDER_RES_V1', { ...variables, configuredEstimate: undefined });
    expect(withoutPrice.text).toContain('tailored quote');
    expect(withoutPrice.text).not.toContain('$13,500');
  });

  it.each(enquiryExperienceFixtures())('keeps $variant focused on receipt and immediate next action', async fixture => {
    const rendered = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables });
    expect(rendered.html).toContain('We’ve received your');
    expect(rendered.text).toContain('reply by email');
    expect(rendered.text).toContain('typically respond within one working day');
    expect(rendered.text).not.toContain(fixture.variables.message);
    expect(rendered.text).not.toContain('Not supplied');
    expect(rendered.text).not.toContain('No additional note supplied');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.text).not.toContain('YOUR PROJECT DETAILS');
    expect(rendered.text).toContain('Reply to this email');
    expect(rendered.html).toContain('mailto:info@sanctuarypergolas.co.nz');
  });

  it('keeps included configured extras distinct from optional legacy blinds and preserves the saved design link', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture('experience-configured');
    const configuredEstimate = { amountIncGst: 31500, currency: 'NZD', includesGst: true, breakdown: [
      { label: 'Pergola, roof & ceiling', amountIncGst: 27500 }, { label: 'Lighting', amountIncGst: 1500 }, { label: 'Outdoor blinds', amountIncGst: 2500 },
    ] };
    const result = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables, configuredEstimate });
    expect(result.text).toContain('$31,500');
    expect(result.text).toContain('All items above are included');
    expect(result.text).toContain('not a quote');
    expect(result.text).not.toContain('additional cost');
    expect(result.text).toContain('Later changes won’t update this enquiry');
    expect(result.html).toContain('configurator-preview?open=1#design=');
    expect(result.html.indexOf('reply by email')).toBeLessThan(result.html.indexOf('$31,500'));
    expect(result.html.indexOf('$31,500')).toBeLessThan(result.html.indexOf('View your submitted pergola'));
    const legacy = getWebsiteAutoresponderPreviewFixture('residential-gable-with-blinds');
    const oldResult = await renderWebsiteAutoresponder(legacy.templateId, { ...legacy.variables });
    expect(oldResult.text).toContain('Outdoor blinds · additional cost');
    expect(oldResult.text).toContain('Added to the pergola estimate above');
    expect(oldResult.text).not.toContain('within one working day');
  });

  it('gives retained professional enquiries an explicit next action without a new timing promise', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture('professional');
    const result = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables });
    expect(result.text).toContain('reply by email');
    expect(result.text).toContain('You don’t need to do anything else for now');
    expect(result.text).not.toContain('within one working day');
  });

  it('does not fabricate an unavailable price or empty attachments, and escapes submitted content', async () => {
    const fixture = getWebsiteAutoresponderPreviewFixture('experience-configured');
    const result = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables, name: '<script>alert(1)</script>', message: 'Do not repeat this long note.', configuredEstimate: { amountIncGst: 1, includesGst: true, currency: 'NZD', breakdown: [{ label: 'Pergola', amountIncGst: 2 }] } });
    expect(result.text).toContain('tailored quote');
    expect(result.text).not.toContain('Your estimated price');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.text).not.toContain('Do not repeat this long note');
    expect(result.text).not.toContain('Files received');
    const fileResult = await renderWebsiteAutoresponder(fixture.templateId, { ...fixture.variables, attachmentLinks: [{ name: 'Plans.pdf', url: 'https://example.test/plan.pdf' }] });
    expect(fileResult.text).toContain('Plans.pdf');
    expect(fileResult.text).toContain('expire seven days');
  });
});
