import { describe, expect, it } from 'vitest';
import type { EmailReviewImport } from '@/lib/emailReview/contracts';
import { reviewImportMaxBytes, validateImportPayload } from './EmailReviewImport';

function payload(count = 1, body = 'Example draft'): EmailReviewImport {
  return {
    commandId: '00000000-0000-4000-8000-000000000001', reviewerId: '00000000-0000-4000-8000-000000000002',
    sourceKey: 'synthetic-import', title: 'Example batch',
    items: Array.from({ length: count }, (_, index) => ({ sourceId: `example-${index}`, projectId: '00000000-0000-4000-8000-000000000003', to: 'example@example.invalid', subject: 'Example', body, prerequisites: [], evidence: [], context: '' })),
  };
}
describe('Review import preflight', () => {
  it('uses the canonical field validation and accepts 500 valid small drafts', () => {
    expect(validateImportPayload(payload(500)).items).toHaveLength(500);
    const invalid = payload(); invalid.items[0].to = 'not-an-email';
    expect(() => validateImportPayload(invalid)).toThrow('invalid fields');
    expect(() => validateImportPayload(payload(501))).toThrow('at most 500');
  });
  it('checks serialized UTF-8 bytes including command and reviewer metadata', () => {
    const input = payload(110, 'x'.repeat(18000));
    const normalized = validateImportPayload(input);
    const current = new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
    const added = reviewImportMaxBytes - current;
    // Spread padding over otherwise valid contexts so no individual field exceeds its limit.
    for (let index = 0, remaining = added; remaining > 0; index++) {
      const size = Math.min(9000, remaining); input.items[index].context = 'x'.repeat(size); remaining -= size;
    }
    expect(new TextEncoder().encode(JSON.stringify(validateImportPayload(input))).byteLength).toBe(reviewImportMaxBytes);
    input.title += 'é';
    expect(() => validateImportPayload(input)).toThrow('complete import exceeds 2 MiB');
  });
});
