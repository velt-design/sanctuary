export type EnquiryType = 'Residential' | 'Commercial' | 'Professional';

const enquiryTypesByRouteValue: Record<string, EnquiryType> = {
  residential: 'Residential',
  commercial: 'Commercial',
  professional: 'Professional',
};

export function getEnquiryTypeFromRouteValue(
  value: string | undefined,
): EnquiryType | null {
  const routeValue = value?.trim().toLowerCase();
  return routeValue ? enquiryTypesByRouteValue[routeValue] ?? null : null;
}

export function getEnquiryTypeFromSearch(search: string): EnquiryType | null {
  return getEnquiryTypeFromRouteValue(
    new URLSearchParams(search).get('enquiry') ?? undefined,
  );
}
