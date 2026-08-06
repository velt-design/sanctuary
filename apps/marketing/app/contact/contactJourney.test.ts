import { describe, expect, it } from 'vitest';
import {
  getContactEnquiryAudience,
  getInitialBusinessAudience,
  getInitialContactPathway,
} from './contactJourney';

describe('contact journey routing', () => {
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

  it('keeps both residential sales pathways on the residential enquiry contract', () => {
    expect(getContactEnquiryAudience('simple', null)).toBe('residential');
    expect(getContactEnquiryAudience('custom', null)).toBe('residential');
    expect(getContactEnquiryAudience(null, null)).toBeNull();
  });
});
