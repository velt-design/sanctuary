import { parseEnquiryContext } from '../../lib/enquiryContext';

export type EnquiryType = 'Residential' | 'Commercial' | 'Professional';

const enquiryTypeLabels = {
  residential: 'Residential',
  commercial: 'Commercial',
  professional: 'Professional',
} as const satisfies Record<string, EnquiryType>;

export function getEnquiryTypeFromRouteValue(
  value: string | undefined,
): EnquiryType | null {
  const enquiryType = parseEnquiryContext({ enquiry_type: value }).enquiryType;
  return enquiryType ? enquiryTypeLabels[enquiryType] : null;
}

export function getEnquiryTypeFromSearch(search: string): EnquiryType | null {
  const params = Object.fromEntries(new URLSearchParams(search).entries());
  return getEnquiryTypeFromRouteValue(
    parseEnquiryContext(params).enquiryType,
  );
}
