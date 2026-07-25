import { describe, expect, it } from 'vitest';
import { getEnquiryTypeFromRouteValue, getEnquiryTypeFromSearch } from './enquiryRoute';

describe('getEnquiryTypeFromSearch', () => {
  it.each([
    ['?enquiry_type=residential', 'residential'],
    ['?source=homepage&enquiry_type=commercial', 'commercial'],
    ['?enquiry_type=Professional', 'professional'],
    ['?enquiry=residential', 'residential'],
    ['?source=homepage&enquiry=commercial', 'commercial'],
    ['?enquiry=Professional', 'professional'],
  ])('maps %s to the contact enquiry type', (search, expected) => {
    expect(getEnquiryTypeFromSearch(search)).toBe(expected);
  });

  it.each(['', '?enquiry=', '?enquiry=general', '?project=professional'])('leaves the chooser open for %s', (search) => {
    expect(getEnquiryTypeFromSearch(search)).toBeNull();
  });

  it('maps the server route value before hydration', () => {
    expect(getEnquiryTypeFromRouteValue(' Professional ')).toBe('professional');
    expect(getEnquiryTypeFromRouteValue('general')).toBeNull();
    expect(getEnquiryTypeFromRouteValue(undefined)).toBeNull();
  });
});
