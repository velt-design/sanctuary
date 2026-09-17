import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import { correspondenceGatewayConfig, readStaffCorrespondence } from './gateway';
import { parseStaffCorrespondence, STAFF_CORRESPONDENCE_VERSION } from './contract';

const projectId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const now = Date.parse(correspondenceFixture.observedAt);
const config = { origin: 'https://velt.example.invalid', secret: 'a'.repeat(64) };
const payload = () => ({ schemaVersion: STAFF_CORRESPONDENCE_VERSION, projectId, requestId, context: structuredClone(correspondenceFixture) });

describe('staff correspondence gateway', () => {
  it('accepts dated saved evidence only within the bound retention window', () => {
    const reply = payload();
    const checkedAt = reply.context.observedAt;
    Object.assign(reply.context, { snapshot: { checkedAt, expiresAt: new Date(now + 24 * 60 * 60_000).toISOString(), state: 'saved', nextAttemptAt: null } });
    expect(parseStaffCorrespondence(reply, projectId, requestId, now + 60 * 60_000).snapshot?.state).toBe('saved');
    expect(() => parseStaffCorrespondence(reply, projectId, requestId, now + 24 * 60 * 60_000)).toThrow();
    Object.assign(reply.context, { snapshot: { checkedAt, expiresAt: new Date(now + 25 * 60 * 60_000).toISOString(), state: 'saved', nextAttemptAt: null } });
    expect(() => parseStaffCorrespondence(reply, projectId, requestId, now)).toThrow();
  });
  it('requests reply evidence only after explicit receiver rollout enablement', async () => {
    const fetcher = vi.fn(async () => Response.json(payload()));
    await readStaffCorrespondence({ ...config, includeMessageLineage: true }, { projectId, actorId }, new AbortController().signal,
      { fetcher, now: () => now, nonce: () => requestId });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toHaveProperty('includeMessageLineage', true);
  });
  it('validates actual message identity, freshness and safe source links independently of citations', () => {
    const reply = payload();
    const message = { id: 'mail-one', subject: 'Site visit', from: 'customer@example.test',
      sentAt: correspondenceFixture.observedAt, receivedAt: correspondenceFixture.observedAt, observedAt: correspondenceFixture.observedAt,
      url: 'https://outlook.office.com/mail/id/one', bodyText: 'Can we arrange a visit?', truncated: false, association: 'customer_address_only' };
    Object.assign(reply.context, { messages: [message] });
    expect(parseStaffCorrespondence(reply, projectId, requestId, now).messages?.[0].bodyText).toBe(message.bodyText);
    for (const patch of [{ observedAt: new Date(now - 120001).toISOString() }, { from: 'not an address' },
      { association: 'project' }, { url: 'https://portal.sanctuarypergolas.co.nz/staff/projects/one' }]) {
      Object.assign(reply.context, { messages: [{ ...message, ...patch }] });
      expect(() => parseStaffCorrespondence(reply, projectId, requestId, now)).toThrow();
    }
    Object.assign(reply.context, { messages: [message, message] });
    expect(() => parseStaffCorrespondence(reply, projectId, requestId, now)).toThrow();
  });
  it('stays disabled without explicit activation and rejects insecure destinations', () => {
    expect(correspondenceGatewayConfig({})).toBeNull();
    for (const origin of ['http://velt.example.invalid', 'https://user@velt.example.invalid', 'https://velt.example.invalid/elsewhere']) {
      expect(() => correspondenceGatewayConfig({ PORTAL_STAFF_CORRESPONDENCE_ENABLED: 'true', PORTAL_VELT_CORRESPONDENCE_ORIGIN: origin, PORTAL_VELT_CORRESPONDENCE_SECRET: config.secret })).toThrow();
    }
  });
  it('signs the exact server identity, destination, timestamp, nonce and body without forwarding cookies', async () => {
    const fetcher = vi.fn(async () => Response.json(payload()));
    const result = await readStaffCorrespondence(config, { projectId, actorId }, new AbortController().signal, { fetcher, now: () => now, nonce: () => requestId });
    expect(result).toEqual(correspondenceFixture);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(JSON.parse(String(init.body))).toEqual({ schemaVersion: STAFF_CORRESPONDENCE_VERSION, projectId, actorId });
    expect(headers.get('x-sanctuary-signature')).toBe(createHmac('sha256', Buffer.from(config.secret, 'hex')).update(['v1', 'POST', url, String(now), requestId, init.body].join('\n')).digest('hex'));
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('authorization')).toBe(false);
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store', credentials: 'omit' });
  });
  it.each(['project', 'nonce', 'stale', 'future', 'missing-source', 'duplicate-topic', 'unsafe-url', 'extra-body'])('rejects %s evidence', kind => {
    const reply = payload();
    if (kind === 'project') reply.projectId = actorId;
    if (kind === 'nonce') reply.requestId = actorId;
    if (kind === 'stale') reply.context.observedAt = new Date(now - 120001).toISOString();
    if (kind === 'future') reply.context.observedAt = new Date(now + 5001).toISOString();
    if (kind === 'missing-source') reply.context.sources = [];
    if (kind === 'duplicate-topic') reply.context.answer.sections[1].topic = 'agreement';
    if (kind === 'unsafe-url') reply.context.sources[0].url = 'https://untrusted.invalid/mail';
    if (kind === 'extra-body') Object.assign(reply.context.sources[0], { body: 'Unrequested private body' });
    expect(() => parseStaffCorrespondence(reply, projectId, requestId, now)).toThrow();
  });
  it('bounds the streamed response and cancels oversized content', async () => {
    const fetcher = vi.fn(async () => new Response(' '.repeat(262145), { headers: { 'content-type': 'application/json' } }));
    await expect(readStaffCorrespondence(config, { projectId, actorId }, new AbortController().signal, { fetcher })).rejects.toThrow('too large');
  });
  it('does not start a read after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn();
    await expect(readStaffCorrespondence(config, { projectId, actorId }, controller.signal, { fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
