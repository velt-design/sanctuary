import { describe, expect, it, vi } from 'vitest';
import {
  EnquiryAttachmentVerificationError,
  verifyStoredEnquiryAttachments,
} from './enquiryStoredAttachments';

const SUBMISSION_ID = '11b80fcf-e00c-4d0b-9bb9-923fccd1d491';

function clientWithBytes(bytes: Uint8Array) {
  const download = vi.fn(async () => ({
    data: { arrayBuffer: async () => bytes.buffer },
    error: null,
  }));
  return {
    client: {
      storage: { from: () => ({ download }) },
    } as any,
    download,
  };
}

describe('verifyStoredEnquiryAttachments', () => {
  it('accepts a valid, submission-bound upload with matching content', async () => {
    const bytes = new TextEncoder().encode('%PDF-valid');
    const { client, download } = clientWithBytes(bytes);
    const result = await verifyStoredEnquiryAttachments(client, {
      submissionId: SUBMISSION_ID,
      uploadSessionToken: 'upload-token',
      files: [{
        path: `pending/${SUBMISSION_ID}/0-plan.pdf`,
        name: 'plan.pdf',
        size: bytes.byteLength,
        type: 'application/pdf',
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ filename: 'plan.pdf', type: 'application/pdf' });
    expect(download).toHaveBeenCalledWith(`pending/${SUBMISSION_ID}/0-plan.pdf`);
  });

  it('rejects a forged path from another submission before downloading', async () => {
    const { client, download } = clientWithBytes(new TextEncoder().encode('%PDF-valid'));
    await expect(verifyStoredEnquiryAttachments(client, {
      submissionId: SUBMISSION_ID,
      uploadSessionToken: 'upload-token',
      files: [{
        path: 'pending/9f6cf997-2021-4f57-8468-b52716c01abc/0-plan.pdf',
        name: 'plan.pdf',
        size: 10,
        type: 'application/pdf',
      }],
    })).rejects.toMatchObject({ code: 'INVALID_ATTACHMENTS' });
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects forged content even when extension and declared MIME match', async () => {
    const bytes = new TextEncoder().encode('<script>x</script>');
    const { client } = clientWithBytes(bytes);
    await expect(verifyStoredEnquiryAttachments(client, {
      submissionId: SUBMISSION_ID,
      uploadSessionToken: 'upload-token',
      files: [{
        path: `pending/${SUBMISSION_ID}/0-plan.pdf`,
        name: 'plan.pdf',
        size: bytes.byteLength,
        type: 'application/pdf',
      }],
    })).rejects.toBeInstanceOf(EnquiryAttachmentVerificationError);
  });

  it('rejects missing binding tokens and attachment-count abuse', async () => {
    const bytes = new TextEncoder().encode('%PDF-valid');
    const { client, download } = clientWithBytes(bytes);
    const validFile = {
      path: `pending/${SUBMISSION_ID}/0-plan.pdf`,
      name: 'plan.pdf',
      size: bytes.byteLength,
      type: 'application/pdf',
    };

    await expect(verifyStoredEnquiryAttachments(client, {
      submissionId: SUBMISSION_ID,
      uploadSessionToken: '',
      files: [validFile],
    })).rejects.toMatchObject({ code: 'INVALID_ATTACHMENTS' });
    await expect(verifyStoredEnquiryAttachments(client, {
      submissionId: SUBMISSION_ID,
      uploadSessionToken: 'upload-token',
      files: Array.from({ length: 9 }, () => ({ ...validFile })),
    })).rejects.toMatchObject({ code: 'INVALID_ATTACHMENTS' });
    expect(download).not.toHaveBeenCalled();
  });
});
