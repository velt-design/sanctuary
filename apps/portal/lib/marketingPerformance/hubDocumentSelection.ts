import { DOCUMENT_CALLBACK_HEADER, prepareRegionalDocumentAccess, regionalDocumentCallback } from '@/lib/regionalDocumentAccess';
import { aucklandDay, defaultFilters, validPeriod } from './contract';

// Middleware writes this callback only for document GETs. It selects work after
// the page's independent authority gates; it can never grant access to a report.
export function marketingDocumentUrl(headers: Headers): URL | null {
  const callback = regionalDocumentCallback(headers.get(DOCUMENT_CALLBACK_HEADER));
  if (!callback) return null;
  const url = new URL(callback, 'https://portal.invalid');
  if (url.pathname !== '/staff/marketing-performance' || url.searchParams.has('_rsc')
    || headers.has('next-router-state-tree') || headers.has('x-nextjs-data')) return null;
  if (!prepareRegionalDocumentAccess(new Request(url, { headers })).eligible) return null;
  return url;
}
export function hubDocumentWindow(headers: Headers, now = new Date()): { start: string; end: string } | null {
  const url=marketingDocumentUrl(headers);
  if(!url)return null;
  const query = url.searchParams;
  if (['start', 'end', 'view'].some(key => query.getAll(key).length > 1)) return null;
  const view = query.get('view') ?? 'overview';
  if (!['overview', 'enquiries', 'sales', 'portfolio'].includes(view)) return null;
  const defaults = defaultFilters(now), start = query.get('start') ?? defaults.start, end = query.get('end') ?? defaults.end;
  return validPeriod(start, end, aucklandDay(now)) ? { start, end } : null;
}
