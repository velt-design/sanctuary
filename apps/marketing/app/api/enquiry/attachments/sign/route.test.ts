import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: h.createClient,
}));

async function post(body: unknown) {
  const { POST } = await import('./route');
  return POST(
    new Request('http://localhost/api/enquiry/attachments/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/enquiry/attachments/sign', () => {
  beforeEach(() => {
    vi.resetModules();
    h.createClient.mockReset();
    h.createSignedUploadUrl.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    h.createSignedUploadUrl.mockImplementation(async (path: string) => ({
      data: { path, signedUrl: `https://upload.test/${path}`, token: `token-${path}` },
      error: null,
    }));
    h.createClient.mockReturnValue({
      storage: { from: () => ({ createSignedUploadUrl: h.createSignedUploadUrl }) },
    });
  });

  it('mints one signed upload URL per file and sanitises the storage path', async () => {
    const res = await post({
      files: [
        { name: 'plan.pdf', size: 1024, type: 'application/pdf' },
        { name: 'eleva tion!.png', size: 2048, type: 'image/png' },
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.uploads).toHaveLength(2);
    expect(json.uploads[0]).toMatchObject({ name: 'plan.pdf' });
    expect(json.uploads[0].path).toMatch(/^pending\/[0-9a-f-]+\/0-plan\.pdf$/);
    expect(json.uploads[0].token).toContain('token-');
    // Original filename is preserved for display, path is sanitised for storage.
    expect(json.uploads[1].name).toBe('eleva tion!.png');
    expect(json.uploads[1].path).toMatch(/\/1-eleva_tion_\.png$/);
  });

  it('rejects more than 8 files', async () => {
    const files = Array.from({ length: 9 }, (_, i) => ({ name: `f${i}.pdf`, size: 10, type: 'application/pdf' }));
    const res = await post({ files });
    expect(res.status).toBe(422);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects when total size exceeds 20MB', async () => {
    const res = await post({
      files: [
        { name: 'a.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' },
        { name: 'b.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' },
      ],
    });
    expect(res.status).toBe(422);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects an empty file list', async () => {
    const res = await post({ files: [] });
    expect(res.status).toBe(422);
  });
});
