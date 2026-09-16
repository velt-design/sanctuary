import { parseEnquiryContext } from '../../lib/enquiryContext';

/** Return only to a local browsing page, never back into the enquiry flow. */
export function enquiryReturnPath(sourcePath?: string): string {
  const path = parseEnquiryContext({ source_path: sourcePath }).sourcePath;
  if (!path || /^\/(design-enquiry|configurator-preview)(\/|$)/.test(path)) return '/';
  return path;
}
