import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublicDepositInvoicePdfByToken } from '@/lib/invoices/publicInvoice';
import { GET } from './route';

vi.mock('@/lib/invoices/publicInvoice', () => ({
  loadPublicDepositInvoicePdfByToken: vi.fn(),
}));

const loadPublicDepositInvoicePdfByTokenMock = vi.mocked(loadPublicDepositInvoicePdfByToken);

function context(invoiceId = 'invoice-123') {
  return { params: Promise.resolve({ invoiceId }) };
}

function getRequest(search = '?token=public-token') {
  return new Request(`https://sanctuary.test/api/invoices/invoice-123/pdf${search}`);
}

describe('public invoice PDF route', () => {
  beforeEach(() => {
    loadPublicDepositInvoicePdfByTokenMock.mockReset();
  });

  it('rejects missing public tokens before PDF lookup', async () => {
    const response = await GET(getRequest(''), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing token' });
    expect(loadPublicDepositInvoicePdfByTokenMock).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid token'],
    ['expired invoice'],
    ['void invoice'],
    ['unavailable PDF artifact'],
  ])('returns unavailable when the domain helper rejects %s', async () => {
    loadPublicDepositInvoicePdfByTokenMock.mockResolvedValueOnce(null);

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Invoice PDF unavailable' });
  });

  it('serves token-bound invoice PDFs with private no-store caching', async () => {
    loadPublicDepositInvoicePdfByTokenMock.mockResolvedValueOnce({
      filename: 'invoice-"123".pdf',
      content: new Uint8Array([37, 80, 68, 70]).buffer,
    });

    const response = await GET(getRequest(), context(' invoice-123 '));

    expect(loadPublicDepositInvoicePdfByTokenMock).toHaveBeenCalledWith({
      invoiceId: 'invoice-123',
      token: 'public-token',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="invoice-123.pdf"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBe(4);
  });
});
