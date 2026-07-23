export type EnquiryType = 'Residential' | 'Commercial' | 'Professional';

const enquiryTypesByRouteValue: Record<string, EnquiryType> = {
  residential: 'Residential',
  commercial: 'Commercial',
  professional: 'Professional',
};

export function getEnquiryTypeFromSearch(search: string): EnquiryType | null {
  const routeValue = new URLSearchParams(search).get('enquiry')?.trim().toLowerCase();
  return routeValue ? enquiryTypesByRouteValue[routeValue] ?? null : null;
}
