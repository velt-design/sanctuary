import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/seo-landing/SeoLandingPage', () => ({ default: () => null }));
import Page, { metadata } from './page';
import { professionalCapabilityConfig as config } from './content';

describe('professional presentation keeps canonical enquiry ownership', () => {
  it('retains the professional config, form fields and canonical route', async () => {
    const page = await Page({});
    expect(page.props.config).toBe(config);
    expect(page.props.guidedContext).toBeNull();
    expect(config.enquiryType).toBe('professional');
    expect(metadata.alternates?.canonical).toBe('/architects-designers-builders');
    expect(config.form.briefFields.map(field => field.name)).toEqual(['organisationAndRole', 'projectStage', 'professionalTeam', 'requestedScope']);
    expect(config.form.briefFields.every(field => !('required' in field))).toBe(true);
    expect(page.props.presentation.hero).toBeTruthy();
    expect(page.props.presentation.content).toBeTruthy();
  });

  it('preserves a guided professional brief and its change-answer attribution', async () => {
    const page = await Page({ searchParams: Promise.resolve({ stage: 'delivery', need: 'delivery-coordination' }) });
    expect(page.props.guidedContext).toMatchObject({ resultId: 'professional', focusId: 'delivery-coordination', enquiryContext: { enquiryType: 'professional', sourceExperience: 'guided-home-v1', sourceComponent: 'embedded_form' } });
    expect(page.props.guidedContext.returnHref).toContain('/home-guided?');
  });
});
