import { describe, expect, it } from 'vitest';
import { ENQUIRY_ATTACHMENT_LIMITS, validateEnquiryAttachments } from './enquiryAttachments';

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
