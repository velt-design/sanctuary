import {
  parseEnquiryContext,
  type EnquiryAudience,
} from '@/lib/enquiryContext';

export type EnquiryType = 'Residential' | 'Commercial' | 'Professional';

const enquiryTypesByRouteValue: Record<EnquiryAudience, EnquiryType> = {
  residential: 'Residential',
  commercial: 'Commercial',
  professional: 'Professional',
};

export function getEnquiryTypeFromRouteValue(
  value: string | undefined,
): EnquiryType | null {
  const routeValue = value?.trim().toLowerCase();
  return routeValue
    ? enquiryTypesByRouteValue[routeValue as EnquiryAudience] ?? null
    : null;
}

export function getEnquiryTypeFromSearch(search: string): EnquiryType | null {
  const context = parseEnquiryContext(new URLSearchParams(search));
  return context.enquiryType
    ? enquiryTypesByRouteValue[context.enquiryType]
    : null;
}

export function getEnquiryTypeFromAudience(
  audience: EnquiryAudience | undefined,
): EnquiryType | null {
  return audience ? enquiryTypesByRouteValue[audience] : null;
}
