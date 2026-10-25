import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import PdfInlinePreview from './QuotePdfInlinePreview';
import { ProjectPdfStream } from './overview/ProjectPdfStream';

const { getDocument, destroy, chunk, done } = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(), chunk: vi.fn(), done: vi.fn() }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument, GlobalWorkerOptions: { workerSrc: '' }, PDFDataRangeTransport: class { onDataProgressiveRead = chunk; onDataProgressiveDone = done; } }));
beforeEach(() => vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingLeft: '0px', paddingRight: '0px' } as CSSStyleDeclaration));
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('PDF viewport evidence ownership', () => {
  it('keeps the actual document owner without inventing pages, then clears bytes and destroys the document', async () => {
    getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, destroy }), destroy: vi.fn() });
    const view = renderIntoDocument(<PdfInlinePreview data={null} />);
    const owner = view.container.firstElementChild;
    expect(view.container.textContent).toContain('Reading PDF');
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(getDocument).not.toHaveBeenCalled();
    const data = new Uint8Array([37, 80, 68, 70]);
    await act(async () => { view.rerender(<PdfInlinePreview data={data} />); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(view.container.firstElementChild).toBe(owner);
    expect(view.container.querySelectorAll('canvas')).toHaveLength(2);
    expect(getDocument).toHaveBeenCalledOnce();
    const retry = vi.fn();
    view.rerender(<PdfInlinePreview data={null} pending={false} readError="PDF unavailable" onRetry={retry} />);
    expect(view.container.firstElementChild).toBe(owner);
    expect(view.container.querySelector('canvas')).toBeNull();
    expect(view.container.textContent).toContain('PDF unavailable');
    act(() => view.container.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('preserves the Files single progressive transport and retires old stream pages/subscriptions on source change', async () => {
    getDocument.mockReturnValueOnce({ promise: Promise.resolve({ numPages: 1, destroy }), destroy: vi.fn() });
    const source = new ProjectPdfStream(4);
    const view = renderIntoDocument(<PdfInlinePreview source={source} />);
    const owner = view.container.firstElementChild;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(view.container.querySelectorAll('canvas')).toHaveLength(1);
    expect(getDocument.mock.lastCall![0]).toMatchObject({ disableRange: true });
    expect(getDocument.mock.lastCall![0].data).toBeUndefined();
    source.append(new Uint8Array([37, 80])); source.append(new Uint8Array([68, 70])); source.finish();
    expect(chunk.mock.calls.map(([bytes]) => Array.from(bytes))).toEqual([[37, 80], [68, 70]]);
    expect(done).toHaveBeenCalledOnce();
    const next = new ProjectPdfStream(4);
    getDocument.mockReturnValueOnce({ promise: new Promise(() => undefined), destroy: vi.fn() });
    await act(async () => { view.rerender(<PdfInlinePreview source={next} />); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(view.container.firstElementChild).toBe(owner);
    expect(view.container.querySelector('canvas')).toBeNull();
    const delivered = chunk.mock.calls.length; source.append(new Uint8Array([0]));
    expect(chunk).toHaveBeenCalledTimes(delivered);
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce(); view.unmount();
  });
});
