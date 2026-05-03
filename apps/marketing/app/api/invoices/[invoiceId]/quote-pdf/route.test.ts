import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublicSourceQuotePdfByInvoiceToken } from '@/lib/invoices/publicInvoice';
import { GET } from './route';

vi.mock('@/lib/invoices/publicInvoice', () => ({
  loadPublicSourceQuotePdfByInvoiceToken: vi.fn(),
}));

const loadPublicSourceQuotePdfByInvoiceTokenMock = vi.mocked(loadPublicSourceQuotePdfByInvoiceToken);

function context(invoiceId = 'invoice-123') {
  return { params: Promise.resolve({ invoiceId }) };
}

function getRequest(search = '?token=public-token') {
  return new Request(`https://sanctuary.test/api/invoices/invoice-123/quote-pdf${search}`);
}

describe('public invoice source quote PDF route', () => {
  beforeEach(() => {
    loadPublicSourceQuotePdfByInvoiceTokenMock.mockReset();
  });

  it('rejects missing public tokens before quote PDF lookup', async () => {
    const response = await GET(getRequest(''), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing token' });
    expect(loadPublicSourceQuotePdfByInvoiceTokenMock).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid token'],
    ['expired invoice'],
    ['void invoice'],
    ['unavailable source quote PDF artifact'],
  ])('returns unavailable when the domain helper rejects %s', async () => {
    loadPublicSourceQuotePdfByInvoiceTokenMock.mockResolvedValueOnce(null);

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Quote PDF unavailable' });
  });

  it('serves token-bound source quote PDFs with private no-store caching and safe filenames', async () => {
    loadPublicSourceQuotePdfByInvoiceTokenMock.mockResolvedValueOnce({
      filename: 'quote/"unsafe".pdf',
      content: Buffer.from([37, 80, 68, 70]),
    });

    const response = await GET(getRequest(), context(' invoice-123 '));

    expect(loadPublicSourceQuotePdfByInvoiceTokenMock).toHaveBeenCalledWith({
      invoiceId: 'invoice-123',
      token: 'public-token',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="quote__unsafe_.pdf"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBe(4);
  });
});
