import { describe, expect, it } from 'vitest';
import { commercialPergolasConfig } from './content';
import { professionalCapabilityConfig } from '../architects-designers-builders/content';

describe('commercial and professional enquiry contracts', () => {
  it.each([commercialPergolasConfig, professionalCapabilityConfig])('keeps $enquiryType canonical identity and optional briefs', (config) => {
    expect(config.showGuideNavigation).toBe(false);
    expect(config.hero.secondaryHref).toMatch(/^#(commercial|professional)-projects$/);
    expect(config.form.briefFields.every(field => !('required' in field))).toBe(true);
    expect(config.form.briefFields.map(field => field.name)).toContain('projectStage');
  });
  it('keeps distinct audiences and useful venue constraints', () => {
    expect(commercialPergolasConfig.enquiryType).toBe('commercial');
    expect(commercialPergolasConfig.route).toBe('/commercial-pergolas-auckland');
    expect(commercialPergolasConfig.form.briefFields.map(field => field.name)).toEqual(['siteAddress', 'projectStage', 'professionalInvolvement', 'operatingConstraints']);
    expect(professionalCapabilityConfig.enquiryType).toBe('professional');
    expect(professionalCapabilityConfig.route).toBe('/architects-designers-builders');
    expect(professionalCapabilityConfig.form.briefFields.map(field => field.name)).toEqual(['organisationAndRole', 'projectStage', 'professionalTeam', 'requestedScope']);
  });
  it('does not offer supply-only or completed-package delivery in metadata or form prompts', () => {
    expect(JSON.stringify(professionalCapabilityConfig)).not.toMatch(/supply-and-install|defined package|deliver.*tender package|supply, installation/i);
    expect(professionalCapabilityConfig.description).toContain('Develop pergola designs');
    expect(professionalCapabilityConfig.form.intro).toContain('optional');
  });
});
