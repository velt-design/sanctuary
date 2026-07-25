import { parseEnquiryContext, type EnquiryAudience } from '../../lib/enquiryContext';

export function getEnquiryTypeFromRouteValue(value: string | undefined): EnquiryAudience | null {
  return parseEnquiryContext({ enquiry_type: value }).enquiryType ?? null;
}

export function getEnquiryTypeFromSearch(search: string): EnquiryAudience | null {
  const params = Object.fromEntries(new URLSearchParams(search).entries());
  return getEnquiryTypeFromRouteValue(parseEnquiryContext(params).enquiryType);
}
