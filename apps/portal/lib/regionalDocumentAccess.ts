import { getSafeCallbackUrl } from './portalAccess';

// Redirect context only. This header never carries identity or authorization.
export const DOCUMENT_CALLBACK_HEADER = 'x-portal-document-callback';

export function isRegionalDocumentPath(path: string): boolean {
  return path === '/staff/projects' || path === '/staff/site-visits' || path === '/staff/marketing-performance' ||
    /^\/staff\/projects\/(?:proj_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
}

export function regionalDocumentCallback(value: string | null): string | null {
  if (!value || value.length > 8_192 || getSafeCallbackUrl(value, '') !== value) return null;
  const url = new URL(value, 'https://portal.invalid');
  return isRegionalDocumentPath(url.pathname) && !url.hash ? value : null;
}

export function prepareRegionalDocumentAccess(request: Request, forwarded?: Headers) {
  const headers = new Headers(forwarded ?? request.headers);
  const suppliedContext = headers.has(DOCUMENT_CALLBACK_HEADER);
  headers.delete(DOCUMENT_CALLBACK_HEADER);
  const url = new URL(request.url);
  const callback = regionalDocumentCallback(`${url.pathname}${url.search}`);
  const eligible = Boolean(callback) && request.method === 'GET' &&
    headers.get('sec-fetch-dest') === 'document' && Boolean(headers.get('accept')?.includes('text/html')) &&
    !headers.has('rsc') && !headers.has('next-action') && !headers.has('next-router-prefetch') &&
    !headers.has('next-router-segment-prefetch') && headers.get('purpose') !== 'prefetch' &&
    !headers.get('sec-purpose')?.includes('prefetch');
  if (eligible) headers.set(DOCUMENT_CALLBACK_HEADER, callback!);
  return { eligible, headers: eligible || suppliedContext || forwarded ? headers : undefined };
}
