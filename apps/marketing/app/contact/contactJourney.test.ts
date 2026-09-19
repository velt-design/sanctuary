import { describe, expect, it } from 'vitest';
import { parseEnquiryContext } from '../../lib/enquiryContext';
import {
  getContactEnquiryAudience,
  getInitialBusinessAudience,
  getInitialContactPathway,
  resolveContactPathway,
} from './contactJourney';

describe('contact journey routing', () => {
  it('continues validated project or product references without inventing bespoke intent', () => {
    const known = { projectSlugs: ['warkworth-outdoor-room'], productSlugs: ['gable'] };
    const project = parseEnquiryContext({ source_project: 'warkworth-outdoor-room', enquiry_type: 'residential' }, known);
    expect(getInitialContactPathway('residential', project)).toBe('help');
    expect(getInitialContactPathway('residential', project, 'bespoke')).toBe('custom');
    expect(getInitialContactPathway('professional', project)).toBe('commercial-professional');
    expect(getInitialContactPathway(null, parseEnquiryContext({ source_product: 'gable' }, known))).toBe('help');
    expect(getInitialContactPathway(null, parseEnquiryContext({ source_project: 'unknown' }, known))).toBeNull();
  });
  it('uses trusted journey context without treating a generic residential audience as a pathway', () => {
    expect(getInitialContactPathway('residential', {})).toBeNull();
    expect(getInitialContactPathway('residential', { projectDirection: 'cover' })).toBe('simple');
    expect(getInitialContactPathway('residential', { projectDirection: 'bespoke' })).toBe('custom');
    expect(getInitialContactPathway('residential', { sourcePath: '/simple-cover-calculator' })).toBe('simple');
  });

  it('combines commercial and professional into one pathway while retaining the audience', () => {
    expect(getInitialContactPathway('professional', {})).toBe('commercial-professional');
    expect(getInitialBusinessAudience(null, { projectProfessionalPath: 'venue' })).toBe('commercial');
    expect(getInitialBusinessAudience(null, { projectProfessionalPath: 'architects-designers' })).toBe('professional');
    expect(getContactEnquiryAudience('commercial-professional', 'professional')).toBe('professional');
  });

  it('does not let a residential source page override the requested business or bespoke route', () => {
    const sourcePath = '/simple-pergolas-auckland';
    for (const audience of ['commercial', 'professional'] as const) {
      expect(getInitialContactPathway(audience, {sourcePath, projectDirection:'cover'}))
        .toBe('commercial-professional');
    }
    expect(getInitialContactPathway('residential', {sourcePath, projectDirection:'bespoke'})).toBe('custom');
    expect(getInitialContactPathway('residential', {sourcePath, projectDirection:'commercial-professional'}))
      .toBe('commercial-professional');
    expect(getInitialContactPathway('residential', {sourcePath, projectDirection:'cover'}, 'help')).toBe('help');
    expect(getInitialContactPathway('residential', {sourcePath, projectDirection:'cover'}, 'bespoke')).toBe('custom');
    expect(getInitialContactPathway('professional', {sourcePath}, 'help')).toBe('commercial-professional');
  });

  it('keeps both residential sales pathways on the residential enquiry contract', () => {
    expect(getContactEnquiryAudience('simple', null)).toBe('residential');
    expect(getContactEnquiryAudience('custom', null)).toBe('residential');
    expect(getContactEnquiryAudience(null, null)).toBeNull();
  });

  it('retains the business audience when a design is attached', () => {
    const pathway = resolveContactPathway('commercial-professional', true);
    expect(pathway).toBe('commercial-professional');
    expect(getContactEnquiryAudience(pathway, 'professional')).toBe('professional');
    expect(resolveContactPathway('custom', true)).toBe('custom');
    expect(resolveContactPathway('simple', true)).toBe('configured');
    expect(resolveContactPathway(null, true)).toBe('configured');
    expect(resolveContactPathway('help', false)).toBe('help');
  });
});
