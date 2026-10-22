// @vitest-environment node
import { expect, it } from 'vitest';
import { DOCUMENT_CALLBACK_HEADER, prepareRegionalDocumentAccess } from '@/lib/regionalDocumentAccess';
import { defaultFilters } from './contract';
import { hubDocumentWindow } from './hubDocumentSelection';

const now = new Date('2026-10-20T11:30:00Z');
const path = '/staff/marketing-performance';
function forwarded(query = '', extra: Record<string, string> = {}, method = 'GET') {
  const request = new Request(`https://portal.example.test${path}${query}`, {
    method, headers: { accept: 'text/html', 'sec-fetch-dest': 'document', ...extra },
  });
  return prepareRegionalDocumentAccess(request).headers ?? new Headers();
}
it('selects only complete Marketing documents and the exact restored date window', () => {
  expect(hubDocumentWindow(forwarded(), now)).toEqual({ start: '2026-09-22', end: '2026-10-21' });
  for (const view of ['overview', 'enquiries', 'sales', 'portfolio']) {
    expect(hubDocumentWindow(forwarded(`?view=${view}&start=2026-09-01&end=2026-09-22&source=fb&campaign=demo`), now))
      .toEqual({ start: '2026-09-01', end: '2026-09-22' });
  }
  expect(hubDocumentWindow(forwarded('?start=2026-10-01'), now)).toEqual({ start: '2026-10-01', end: '2026-10-21' });
});
it('keeps Auckland defaults correct across midnight and daylight saving boundaries', () => {
  for (const instant of ['2026-09-26T13:59:59Z', '2026-09-26T14:00:00Z', '2026-10-20T10:59:59Z', '2026-10-20T11:00:00Z']) {
    const date = new Date(instant), { start, end } = defaultFilters(date);
    expect(hubDocumentWindow(forwarded(), date)).toEqual({ start, end });
  }
});
it('skips Financials, ambiguous or invalid windows without choosing a substitute report', () => {
  for (const query of ['?view=financials', '?view=unknown', '?view=sales&view=enquiries', '?start=2026-09-01&start=2026-09-02',
    '?end=2026-09-22&end=2026-09-23', '?start=2026-02-30', '?start=', '?start=2025-01-01', '?end=2026-10-22', '?_rsc=abc'])
    expect(hubDocumentWindow(forwarded(query), now)).toBeNull();
});
it('cannot turn spoofed callback context, RSC, prefetch, action, API, child or POST requests into seeds', () => {
  for (const [key, value] of Object.entries({ rsc: '1', 'next-action': 'id', 'next-router-prefetch': '1',
    'next-router-segment-prefetch': '1', purpose: 'prefetch', 'sec-purpose': 'prefetch', 'sec-fetch-dest': 'empty', accept: 'text/x-component',
    'next-router-state-tree': '[]', 'x-nextjs-data': '1' })) {
    expect(hubDocumentWindow(forwarded('', { [DOCUMENT_CALLBACK_HEADER]: `${path}?view=sales`, [key]: value }), now)).toBeNull();
  }
  expect(hubDocumentWindow(forwarded('', { [DOCUMENT_CALLBACK_HEADER]: path }, 'POST'), now)).toBeNull();
  for (const target of ['/api/staff/v1/marketing-performance/hub', `${path}/child`, '/staff/projects']) {
    const incoming = new Request(`https://portal.example.test${target}`, { headers: { accept: 'text/html', 'sec-fetch-dest': 'document', [DOCUMENT_CALLBACK_HEADER]: path } });
    expect(hubDocumentWindow(prepareRegionalDocumentAccess(incoming).headers ?? new Headers(), now)).toBeNull();
  }
  expect(hubDocumentWindow(new Headers({ [DOCUMENT_CALLBACK_HEADER]: path }), now)).toBeNull();
});
