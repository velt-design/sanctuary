import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENQUIRY_ATTACHMENT_LIMITS,
  ENQUIRY_ATTACHMENT_UPLOAD_ERROR,
  uploadEnquiryAttachments,
  validateEnquiryAttachments,
} from './enquiryAttachments';

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: h.createClient,
}));

function file(name: string, size: number, type = name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateEnquiryAttachments', () => {
  it('accepts the signed-upload route limits', () => {
    expect(validateEnquiryAttachments([file('site-photo.jpg', 1024), file('plan.pdf', 2048)])).toBeNull();
  });

  it('rejects more than eight files', () => {
    const files = Array.from({ length: ENQUIRY_ATTACHMENT_LIMITS.maxFiles + 1 }, (_, index) => file(`${index}.jpg`, 1));
    expect(validateEnquiryAttachments(files)).toBe('Add no more than 8 files.');
  });

  it('rejects an attachment over 20 MB', () => {
    expect(validateEnquiryAttachments([file('large-plan.pdf', ENQUIRY_ATTACHMENT_LIMITS.maxFileBytes + 1)]))
      .toBe('Each file must be larger than 0 bytes and no larger than 20 MB.');
  });

  it('rejects a combined payload over 20 MB', () => {
    expect(validateEnquiryAttachments([
      file('one.pdf', ENQUIRY_ATTACHMENT_LIMITS.maxTotalBytes / 2 + 1),
      file('two.pdf', ENQUIRY_ATTACHMENT_LIMITS.maxTotalBytes / 2 + 1),
    ])).toBe('Attachments must be no larger than 20 MB in total.');
  });

  it('rejects executable or mismatched file types', () => {
    expect(validateEnquiryAttachments([file('payload.exe', 100, 'application/x-msdownload')]))
      .toBe('Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.');
    expect(validateEnquiryAttachments([file('renamed.jpg', 100, 'application/pdf')]))
      .toBe('Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.');
  });
});

describe('uploadEnquiryAttachments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'publishable-key';
    h.uploadToSignedUrl.mockReset();
    h.uploadToSignedUrl.mockResolvedValue({ data: { path: 'stored' }, error: null });
    h.createClient.mockReset();
    h.createClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({ uploadToSignedUrl: h.uploadToSignedUrl })),
      },
    });
  });

  it('returns only stored attachment descriptors after every signed upload succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        uploads: [{
          path: 'pending/submission-1/0-site-photo.jpg',
          token: 'signed-upload-token',
        }],
        uploadSessionToken: 'upload-session-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const attachment = file('site-photo.jpg', 1024);

    await expect(
      uploadEnquiryAttachments([attachment], 'submission-1'),
    ).resolves.toEqual({
      files: [{
        name: 'site-photo.jpg',
        size: 1024,
        type: 'image/jpeg',
        path: 'pending/submission-1/0-site-photo.jpg',
      }],
      uploadSessionToken: 'upload-session-token',
    });
    expect(h.uploadToSignedUrl).toHaveBeenCalledWith(
      'pending/submission-1/0-site-photo.jpg',
      'signed-upload-token',
      attachment,
      { contentType: 'image/jpeg' },
    );
  });

  it('fails visibly when the server cannot prepare signed uploads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Storage unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    await expect(
      uploadEnquiryAttachments([file('site-photo.jpg', 1024)], 'submission-1'),
    ).rejects.toThrow(ENQUIRY_ATTACHMENT_UPLOAD_ERROR);
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it('fails visibly instead of returning metadata when a direct upload fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        uploads: [{
          path: 'pending/submission-1/0-site-photo.jpg',
          token: 'signed-upload-token',
        }],
        uploadSessionToken: 'upload-session-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    h.uploadToSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('Bucket not found'),
    });

    await expect(
      uploadEnquiryAttachments([file('site-photo.jpg', 1024)], 'submission-1'),
    ).rejects.toThrow(ENQUIRY_ATTACHMENT_UPLOAD_ERROR);
  });
});
