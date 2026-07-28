import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptPublicQuoteByToken } from '@/lib/quotes/publicQuote';
import { POST } from './route';

vi.mock('@/lib/quotes/publicQuote', () => ({
  acceptPublicQuoteByToken: vi.fn(),
}));

const acceptPublicQuoteByTokenMock = vi.mocked(acceptPublicQuoteByToken);

function context(quoteId: string) {
  return { params: Promise.resolve({ quoteId }) };
}

function postRequest(token?: string) {
  const form = new FormData();
  if (token !== undefined) form.set('token', token);
  return new Request('https://sanctuary.test/api/quotes/quote-123/accept', {
    method: 'POST',
    body: form,
  });
}

describe('public quote accept route', () => {
  beforeEach(() => {
    acceptPublicQuoteByTokenMock.mockReset();
  });

  it('rejects missing public tokens before the domain helper runs', async () => {
    const response = await POST(postRequest(), context('quote-123'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing token' });
    expect(acceptPublicQuoteByTokenMock).not.toHaveBeenCalled();
  });

  it('redirects accepted tokens without exposing token material outside the query string flow', async () => {
    acceptPublicQuoteByTokenMock.mockResolvedValueOnce({
      ok: true,
      alreadyAccepted: false,
      invoiceDelivery: 'sent',
    });

    const response = await POST(postRequest('public-token'), context(' quote-123 '));

    expect(acceptPublicQuoteByTokenMock).toHaveBeenCalledWith({
      quoteId: 'quote-123',
      token: 'public-token',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://sanctuary.test/quote/quote-123?token=public-token');
  });

  it.each([
    ['invalid', 'invalid'],
    ['expired', 'expired'],
    ['declined or otherwise locked', 'invalid_status'],
  ])('redirects %s public-token failures with the domain error code', async (_label, code) => {
    acceptPublicQuoteByTokenMock.mockResolvedValueOnce({
      ok: false,
      code: code as 'invalid' | 'expired' | 'invalid_status',
      message: 'Unable to accept quote',
    });

    const response = await POST(postRequest('public-token'), context('quote-123'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `https://sanctuary.test/quote/quote-123?token=public-token&error=${code}`,
    );
  });
});
