import { describe, expect, it } from 'vitest';
import { enquiryReturnPath } from './enquiryReturnPath';

describe('enquiry browsing exit', () => {
  it('returns to the source browsing page', () => {
    expect(enquiryReturnPath('/products')).toBe('/products');
    expect(enquiryReturnPath('/projects/example')).toBe('/projects/example');
    expect(enquiryReturnPath('/contact')).toBe('/contact');
  });
  it.each([undefined, '/design-enquiry', '/configurator-preview', '//example.com', '/\\example.com', 'https://example.com', '/contact?configurator=preview'])('falls back home for unsafe or enquiry sources: %s', source => {
    expect(enquiryReturnPath(source)).toBe('/');
  });
});
