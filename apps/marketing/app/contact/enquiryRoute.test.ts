import { describe, expect, it } from 'vitest';
import { getEnquiryTypeFromSearch } from './enquiryRoute';

describe('getEnquiryTypeFromSearch', () => {
  it.each([
    ['?enquiry=residential', 'Residential'],
    ['?source=homepage&enquiry=commercial', 'Commercial'],
    ['?enquiry=Professional', 'Professional'],
  ])('maps %s to the contact enquiry type', (search, expected) => {
    expect(getEnquiryTypeFromSearch(search)).toBe(expected);
  });

  it.each(['', '?enquiry=', '?enquiry=general', '?project=professional'])(
    'leaves the chooser open for %s',
    (search) => {
      expect(getEnquiryTypeFromSearch(search)).toBeNull();
    },
  );
});
