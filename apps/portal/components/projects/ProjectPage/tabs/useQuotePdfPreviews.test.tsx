import { act, Profiler, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { QuoteVersionDetail } from '@/lib/quotes/types';
import { useQuotePdfPreviews } from './useQuotePdfPreviews';
const { previewQuotePdf } = vi.hoisted(() => ({ previewQuotePdf: vi.fn() }));
vi.mock('@/lib/quotes/quotesRepo', () => ({ previewQuotePdf, quotePdfUrl: (id: string) => `/quotes/${id}/pdf` }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('withholds old PDF bytes on the first draft-change commit and keys the complete renderer input', async () => {
  vi.useFakeTimers();
  const detail = { id: 'qv_1', status: 'DRAFT', renderHash: 'old-server-hash', paymentTerms: [{ label: 'First term' }], header: { customerName: 'Fictional customer' } } as unknown as QuoteVersionDetail;
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  previewQuotePdf.mockResolvedValue(bytes);
  const commits: string[] = [];
  function Host({ source }: { source: QuoteVersionDetail }) {
    const cacheRef = useRef(new Map<string, Uint8Array>());
    const state = useQuotePdfPreviews({ pagePreviewFromUrl: true, previewDetail: source, sendOpen: true, sendEditorMode: 'review', reviewQuoteDetail: source, cacheRef });
    return <output>{JSON.stringify({ page: state.quotePdfPreviewData?.byteLength ?? null, pagePending: state.quotePdfPreviewLoading, review: state.sendReviewPdfData?.byteLength ?? null, reviewPending: state.sendReviewPdfLoading })}</output>;
  }
  const element = (source: QuoteVersionDetail) => <Profiler id="pdf-request" onRender={() => commits.push(document.querySelector('output')?.textContent ?? '')}><Host source={source} /></Profiler>;
  const view = renderIntoDocument(element(detail));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(view.container.textContent).toContain('"page":8');
  expect(view.container.textContent).toContain('"review":8');
  const changed = { ...detail, paymentTerms: [{ label: 'Different complete terms' }] } as unknown as QuoteVersionDetail;
  const resolvers: Array<(value: Uint8Array) => void> = [];
  previewQuotePdf.mockImplementation(() => new Promise((accept) => { resolvers.push(accept); }));
  commits.length = 0;
  view.rerender(element(changed));
  expect(commits[0]).toContain('"page":null'); expect(commits[0]).toContain('"pagePending":true');
  expect(commits[0]).toContain('"review":null'); expect(commits[0]).toContain('"reviewPending":true');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); resolvers.forEach((resolve) => resolve(bytes)); });
  expect(view.container.textContent).toContain('"page":8');
  view.unmount();
});
