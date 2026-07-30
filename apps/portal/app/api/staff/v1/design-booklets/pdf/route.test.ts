import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSessionMock = vi.fn();
const handleRequestMock = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  requireStaffSession: () => requireStaffSessionMock(),
}));

vi.mock('@/lib/designBooklets/pdfRoute', () => ({
  handleDesignBookletPdfRequest: (request: Request) =>
    handleRequestMock(request),
}));

import { POST } from './route';

describe('staff design booklet PDF route', () => {
  beforeEach(() => {
    requireStaffSessionMock.mockReset();
    handleRequestMock.mockReset();
  });

  it('rejects unauthenticated PDF generation', async () => {
    requireStaffSessionMock.mockResolvedValue(null);
    const response = await POST(new Request('http://localhost', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(handleRequestMock).not.toHaveBeenCalled();
  });

  it('delegates an authenticated request to the booklet renderer', async () => {
    requireStaffSessionMock.mockResolvedValue({ user: { id: 'staff_1' } });
    handleRequestMock.mockResolvedValue(new Response('pdf', { status: 200 }));
    const request = new Request('http://localhost', { method: 'POST' });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(handleRequestMock).toHaveBeenCalledWith(request);
  });
});
