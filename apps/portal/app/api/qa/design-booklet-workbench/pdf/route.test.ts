import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handleRequestMock = vi.fn();
const originalFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('@/lib/designBooklets/pdfRoute', () => ({
  handleDesignBookletPdfRequest: (request: Request) =>
    handleRequestMock(request),
}));

import { POST } from './route';

describe('QA design booklet PDF route', () => {
  beforeEach(() => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    handleRequestMock.mockReset();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalFlag;
    }
  });

  it('is hidden when portal QA fixtures are disabled', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST' }));
    expect(response.status).toBe(404);
    expect(handleRequestMock).not.toHaveBeenCalled();
  });

  it('renders through the shared production handler when enabled', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';
    handleRequestMock.mockResolvedValue(new Response('pdf', { status: 200 }));
    const request = new Request('http://localhost', { method: 'POST' });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(handleRequestMock).toHaveBeenCalledWith(request);
  });
});
