import { getSafeCallbackUrl } from '@/lib/portalAccess';

export function safePortalDocumentHref(
  href: string | null | undefined,
  fallback = '/login',
): string {
  return getSafeCallbackUrl(href, fallback);
}

export function currentPortalDocumentHref(): string {
  if (typeof window === 'undefined') return '/dashboard';
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Cross-user and access-boundary changes require a new document so Next's
 * in-memory Router/RSC cache cannot outlive the verified portal owner.
 */
export function replacePortalDocument(
  href: string | null | undefined,
  fallback = '/login',
): void {
  if (typeof window === 'undefined') return;
  window.location.replace(safePortalDocumentHref(href, fallback));
}
