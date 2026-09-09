import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createResendEmailGateway, normalizeEmailMessage, parseEmailEnquiryReference, prepareResendEmailMessage } from './index';

const reference = parseEmailEnquiryReference('sp_enq_11111111-1111-4111-8111-111111111111');
const input = { from: 'info@example.test', to: 'customer@example.test', subject: ' Hello ', text: 'Hello' };

describe('typed enquiry reference', () => {
  it.each(['', 'lead-1', 'sp_enq_11111111-1111-1111-8111-111111111111', `${reference}\r\nBcc: evil@example.test`, ` ${reference}`, null, {}, reference.toUpperCase()])('rejects malformed references %j', (value) => {
    expect(() => parseEmailEnquiryReference(value)).toThrow('EMAIL_FIELD_INVALID');
    expect(() => normalizeEmailMessage({ ...input, enquiryReference: value as typeof reference })).toThrow('EMAIL_FIELD_INVALID');
  });

  it('preserves legacy wire bytes and ignores arbitrary header bags', () => {
    const prepared = prepareResendEmailMessage({ ...input, headers: { 'X-Injected': 'bad' } } as typeof input);
    expect(prepared.canonicalRequestBody).toBe('{"from":"info@example.test","to":["customer@example.test"],"subject":"Hello","text":"Hello"}');
    expect(prepared.payloadHash).toBe(createHash('sha256').update(prepared.canonicalRequestBody).digest('hex'));
    expect(JSON.parse(prepared.canonicalRequestBody)).not.toHaveProperty('headers');
  });

  it('hashes the fixed header and sends the same deeply frozen normalized bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const prepared = prepareResendEmailMessage({ ...input, enquiryReference: reference, attachments: [{ filename: 'plan.pdf', content: bytes }] });
    bytes.fill(9);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ id: 'api-message-1' }), { status: 200 }));
    await createResendEmailGateway({ apiKey: 'synthetic-test-only', fetch }).dispatchLegacy(prepared.message, { timeoutMs: 1000, idempotencyKey: 'website:autoresponder:enquiry-1' });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ body: prepared.canonicalRequestBody });
    const wire = JSON.parse(prepared.canonicalRequestBody);
    expect(wire.headers).toEqual({ 'X-Sanctuary-Enquiry-Reference': reference });
    expect(wire).not.toHaveProperty('tags');
    expect(wire.attachments[0].content).toBe('AQID');
    expect(Object.isFrozen(prepared.message)).toBe(true);
    expect(prepareResendEmailMessage(prepared.message)).toEqual(prepared);
    const changed = prepareResendEmailMessage({ ...input, enquiryReference: parseEmailEnquiryReference('sp_enq_22222222-2222-4222-8222-222222222222') });
    expect(changed.payloadHash).not.toBe(prepareResendEmailMessage({ ...input, enquiryReference: reference }).payloadHash);
  });
});
