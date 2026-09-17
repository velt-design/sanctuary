// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createResendSentEmailReader } from './index';

const id = '11111111-1111-4111-8111-111111111111';
const input = { providerMessageId: id, expectedRecipients: ['customer@example.test'] };
const evidence = { object: 'email', id, message_id: '<CaseSensitive@example.test>', to: ['customer@example.test'],
  html: '<p>Private contents must not escape this boundary.</p>' };
function setup(value: unknown = evidence, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value), { status }));
  return { fetcher, read: createResendSentEmailReader({ apiKey: 'test-key', fetch: fetcher }) };
}

describe('project send-log identity read', () => {
  it('uses one fixed-origin GET and returns only the verified identity, preserving RFC ID case', async () => {
    const { read, fetcher } = setup();
    expect(await read(input)).toEqual({ state: 'verified', providerMessageId: id, internetMessageId: evidence.message_id });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`https://api.resend.com/emails/${id}`, expect.objectContaining({ method: 'GET', redirect: 'error', cache: 'no-store' }));
  });
  it('matches normalized recipient sets without accepting an extra recipient', async () => {
    expect(await setup({ ...evidence, to: ['CUSTOMER@example.test'] }).read(input)).toMatchObject({ state: 'verified' });
    expect(await setup({ ...evidence, to: [...evidence.to, 'other@example.test'] }).read(input)).toMatchObject({ state: 'unavailable' });
  });
  it.each([
    { ...evidence, id: '22222222-2222-4222-8222-222222222222' },
    { ...evidence, to: ['other@example.test'] },
    { ...evidence, message_id: undefined },
    { ...evidence, message_id: id },
    { ...evidence, message_id: '<id@example.test>\r\nInjected: yes' },
    { ...evidence, message_id: '<é@example.test>' },
    { ...evidence, to: [] },
    { ...evidence, object: 'other' },
  ])('does not establish an anchor from mismatched or malformed evidence %#', async value => {
    expect(await setup(value).read(input)).toEqual({ state: 'unavailable', reason: 'invalid_response' });
  });
  it.each([[401, 'denied'], [403, 'denied'], [404, 'not_found'], [429, 'rate_limited'], [500, 'provider_error']] as const)(
    'does not retry or expose response content for HTTP %s', async (status, reason) => {
      const { read, fetcher } = setup({ message: 'private provider error' }, status);
      expect(await read(input)).toEqual({ state: 'unavailable', reason });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  it('rejects path injection before contacting the provider', async () => {
    const { read, fetcher } = setup();
    expect(await read({ ...input, providerMessageId: '../emails' })).toEqual({ state: 'unavailable', reason: 'invalid_input' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds streamed response size without trusting Content-Length', async () => {
    expect(await setup({ ...evidence, html: 'x'.repeat(262_144) }).read(input)).toEqual({ state: 'unavailable', reason: 'invalid_response' });
  });
  it('honours cancellation before the provider request', async () => {
    const { read, fetcher } = setup();
    expect(await read(input, AbortSignal.abort())).toEqual({ state: 'unavailable', reason: 'aborted' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds provider latency', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const read = createResendSentEmailReader({ apiKey: 'test-key', fetch: fetcher, timeoutMs: 5 });
    expect(await read(input)).toEqual({ state: 'unavailable', reason: 'aborted' });
  });
});
