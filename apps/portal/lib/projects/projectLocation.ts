import type { Project } from '@/lib/types/project';

const clean = (value: string) => value.trim().replace(/\s+\d{4}$/, '').trim();
const isStreet = (value: string) => /\d|\b(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|crescent|cres|place|pl|terrace|tce|highway|hwy)$/i.test(value);

/** Display-only summary of saved text; never geocode or rewrite the address. */
export function projectLocation(project: Pick<Project, 'siteAddress' | 'address' | 'region'>): string {
  const address = (project.siteAddress ?? project.address ?? '').trim();
  const region = (project.region ?? '').trim();
  if (!address) return region || 'Location not recorded';
  const parts = address.split(/,|\n/).map(clean).filter(Boolean);
  if (/^(?:new zealand|nz)$/i.test(parts.at(-1) ?? '')) parts.pop();
  // Some saved addresses include the separately recorded region after the city.
  if (parts.length > 2 && region && region.toLowerCase() !== 'auckland'
    && parts.at(-1)?.toLowerCase() === region.toLowerCase()) parts.pop();
  const city = parts.at(-1);
  if (city && !isStreet(city)) {
    if (/^auckland$/i.test(city)) {
      const suburb = parts.at(-2);
      return suburb && !isStreet(suburb) ? suburb : city;
    }
    return city;
  }
  // Single localities are already useful. Ambiguous free text stays verbatim;
  // do not invent a suburb by removing words from an unstructured street address.
  return address;
}
