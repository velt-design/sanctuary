import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitEnquiryMock } = vi.hoisted(() => ({
  submitEnquiryMock: vi.fn(),
}));

vi.mock('../route', () => ({
  POST: submitEnquiryMock,
}));

import { POST } from './route';

function formRequest(body: URLSearchParams): Request {
  return new Request('http://localhost/api/enquiry/fallback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'http://localhost',
    },
    body,
  });
}

describe('POST /api/enquiry/fallback', () => {
  beforeEach(() => {
    submitEnquiryMock.mockReset();
  });

  it('converts a native form post to the governed API payload and redirects on success', async () => {
    submitEnquiryMock.mockImplementation(async (request: Request) => {
      const payload = await request.json();
      expect(payload).toMatchObject({
        enquiryType: 'commercial',
        name: 'Test Person',
        phone: '021 000 0000',
        email: 'test@example.com',
        page: '/commercial-pergolas-auckland',
        roofMaterials: ['acrylic', 'timber'],
      });
      expect(payload.submissionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      return NextResponse.json({ ok: true });
    });

    const body = new URLSearchParams();
    body.set('enquiryType', 'commercial');
    body.set('name', 'Test Person');
    body.set('phone', '021 000 0000');
    body.set('email', 'test@example.com');
    body.set('page', '/commercial-pergolas-auckland');
    body.set('roofPreference', 'Combination roofing');

    const response = await POST(formRequest(body));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost/contact/thanks',
    );
  });

  it('returns a safe, usable HTML failure without exposing API details', async () => {
    submitEnquiryMock.mockResolvedValue(
      NextResponse.json(
        { ok: false, error: 'internal database details' },
        { status: 503 },
      ),
    );

    const body = new URLSearchParams({
      enquiryType: 'residential',
      name: 'Test Person',
      phone: '021 000 0000',
      email: 'test@example.com',
    });
    const response = await POST(formRequest(body));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('Your enquiry was not sent.');
    expect(html).toContain('Use your browser’s Back button');
    expect(html).not.toContain('internal database details');
  });

  it('keeps unexpected intake failures inside the safe recovery page', async () => {
    submitEnquiryMock.mockRejectedValue(new Error('unexpected failure'));

    const response = await POST(formRequest(new URLSearchParams({
      enquiryType: 'residential',
      name: 'Test Person',
      phone: '021 000 0000',
      email: 'test@example.com',
    })));

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Your enquiry was not sent.');
  });

  it('rejects an oversized streamed body without relying on Content-Length', async () => {
    const request = formRequest(new URLSearchParams({
      message: 'x'.repeat(129 * 1024),
    }));
    expect(request.headers.get('content-length')).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(submitEnquiryMock).not.toHaveBeenCalled();
  });
});
