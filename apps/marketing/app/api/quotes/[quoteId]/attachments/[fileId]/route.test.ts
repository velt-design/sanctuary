import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPublicQuoteAttachmentByToken } from '@/lib/quotes/publicQuote';
import { GET } from './route';

vi.mock('@/lib/quotes/publicQuote', () => ({
  downloadPublicQuoteAttachmentByToken: vi.fn(),
}));

const downloadPublicQuoteAttachmentByTokenMock = vi.mocked(downloadPublicQuoteAttachmentByToken);

function context(params: { quoteId?: string; fileId?: string } = {}) {
  return {
    params: Promise.resolve({
      quoteId: params.quoteId ?? 'quote-123',
      fileId: params.fileId ?? 'file-123',
    }),
  };
}

function getRequest(search = '?token=public-token') {
  return new Request(`https://sanctuary.test/api/quotes/quote-123/attachments/file-123${search}`);
}

describe('public quote attachment route', () => {
  beforeEach(() => {
    downloadPublicQuoteAttachmentByTokenMock.mockReset();
  });

  it('rejects missing public tokens before attachment lookup', async () => {
    const response = await GET(getRequest(''), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing token' });
    expect(downloadPublicQuoteAttachmentByTokenMock).not.toHaveBeenCalled();
  });

  it('keeps invalid public-token failures distinct from unavailable attachments', async () => {
    downloadPublicQuoteAttachmentByTokenMock.mockResolvedValueOnce({
      ok: false,
      code: 'invalid',
      message: 'Invalid quote link',
    });

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid quote link',
      code: 'invalid',
    });
  });

  it('returns gone when the public token has expired', async () => {
    downloadPublicQuoteAttachmentByTokenMock.mockResolvedValueOnce({
      ok: false,
      code: 'expired',
      message: 'Quote link has expired',
    });

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: 'Quote link has expired',
      code: 'expired',
    });
  });

  it('returns not found when the token is valid but the attachment is unavailable', async () => {
    downloadPublicQuoteAttachmentByTokenMock.mockResolvedValueOnce({
      ok: false,
      code: 'not_found',
      message: 'Attachment not found',
    });

    const response = await GET(getRequest(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Attachment not found',
      code: 'not_found',
    });
  });

  it('serves token-scoped PDF attachments with private no-store caching and safe filenames', async () => {
    downloadPublicQuoteAttachmentByTokenMock.mockResolvedValueOnce({
      ok: true,
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: 'application/pdf',
      filename: 'quote/"unsafe".pdf',
    });

    const response = await GET(getRequest(), context());

    expect(downloadPublicQuoteAttachmentByTokenMock).toHaveBeenCalledWith({
      quoteId: 'quote-123',
      token: 'public-token',
      fileId: 'file-123',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="quote__unsafe_.pdf"');
    expect(response.headers.get('cache-control')).toBe('private, max-age=0, no-store');
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBe(4);
  });
});
