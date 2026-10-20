import { isInlineFunnelPath } from './googleFunnel';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARACTERS_PATTERN = /^\+?[\d\s().-]+$/;

export function isValidEnquiryEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isPlausibleEnquiryPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_CHARACTERS_PATTERN.test(trimmed)) return false;

  const digitCount = trimmed.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15;
}
/** Contact requirements are independent of a page's acquisition channel or chrome. */
export function allowsOptionalEnquiryPhone(audience: string, page: string, requestType: string): boolean {
  return audience === 'residential' && isInlineFunnelPath(page)
    && (!['/aluminium-pergolas-auckland', '/custom-pergolas-auckland', '/outdoor-rooms-auckland'].includes(page) || requestType === 'project-discussion');
}
