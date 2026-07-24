import { beforeEach, describe, expect, it, vi } from 'vitest';

const SUBMISSION_ID = '3f76c948-92de-43fd-9537-7726aee17d28';

const h = vi.hoisted(() => ({
  getServiceSupabase: vi.fn(),
  rpc: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

vi.mock('@/lib/supabaseService', () => ({
  getServiceSupabase: h.getServiceSupabase,
}));

async function post(body: unknown, origin?: string) {
  const { POST } = await import('./route');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return POST(
    new Request('http://localhost/api/enquiry/attachments/sign', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/enquiry/attachments/sign', () => {
  beforeEach(() => {
    vi.resetModules();
    h.getServiceSupabase.mockReset();
    h.rpc.mockReset();
    h.createSignedUploadUrl.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    h.rpc.mockResolvedValue({
      data: [{ allowed: true, retry_after_seconds: 0, expires_at: '2026-07-23T12:15:00Z' }],
      error: null,
    });
    h.createSignedUploadUrl.mockImplementation(async (path: string) => ({
      data: { path, signedUrl: `https://upload.test/${path}`, token: `token-${path}` },
      error: null,
    }));
    h.getServiceSupabase.mockReturnValue({
      rpc: h.rpc,
      storage: { from: () => ({ createSignedUploadUrl: h.createSignedUploadUrl }) },
    });
  });

  it('mints submission-bound signed URLs and a short-lived session token', async () => {
    const res = await post({
      submissionId: SUBMISSION_ID,
      files: [
        { name: 'plan.pdf', size: 1024, type: 'application/pdf' },
        { name: 'eleva tion!.png', size: 2048, type: 'image/png' },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      submissionId: SUBMISSION_ID,
      expiresAt: '2026-07-23T12:15:00Z',
    });
    expect(json.uploadSessionToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(json.uploads).toHaveLength(2);
    expect(json.uploads[0].path).toBe(`pending/${SUBMISSION_ID}/0-plan.pdf`);
    expect(json.uploads[1].path).toBe(`pending/${SUBMISSION_ID}/1-eleva_tion_.png`);
    expect(h.rpc).toHaveBeenCalledWith(
      'marketing_enquiry_prepare_upload_session',
      expect.objectContaining({
        p_submission_id: SUBMISSION_ID,
        p_files: expect.arrayContaining([
          expect.objectContaining({ path: `pending/${SUBMISSION_ID}/0-plan.pdf` }),
        ]),
      }),
    );
  });

  it('rejects invalid types, limits, and absent files before storage access', async () => {
    const invalidBodies = [
      { submissionId: SUBMISSION_ID, files: [] },
      {
        submissionId: SUBMISSION_ID,
        files: Array.from({ length: 9 }, (_, i) => ({
          name: `f${i}.pdf`,
          size: 10,
          type: 'application/pdf',
        })),
      },
      {
        submissionId: SUBMISSION_ID,
        files: [
          { name: 'a.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' },
          { name: 'b.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' },
        ],
      },
      {
        submissionId: SUBMISSION_ID,
        files: [{ name: 'payload.exe', size: 10, type: 'application/x-msdownload' }],
      },
      {
        submissionId: SUBMISSION_ID,
        files: [{ name: 'renamed.jpg', size: 10, type: 'application/pdf' }],
      },
    ];

    for (const body of invalidBodies) {
      const res = await post(body);
      expect(res.status).toBe(422);
    }
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects forged origins', async () => {
    const res = await post(
      {
        submissionId: SUBMISSION_ID,
        files: [{ name: 'plan.pdf', size: 100, type: 'application/pdf' }],
      },
      'https://attacker.example',
    );
    expect(res.status).toBe(403);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('enforces the durable upload-session rate limit', async () => {
    h.rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 321 }],
      error: null,
    });
    const res = await post({
      submissionId: SUBMISSION_ID,
      files: [{ name: 'plan.pdf', size: 100, type: 'application/pdf' }],
    });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('321');
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
