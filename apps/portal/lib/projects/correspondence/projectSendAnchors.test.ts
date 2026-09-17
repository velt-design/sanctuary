import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readProjectSendAnchors } from './projectSendAnchors';
import { createVerifiedSendIdentityCache } from './verifiedSendIdentityCache';
vi.mock('./enquirySendEvidence', () => ({ readEnquirySendEvidence: vi.fn().mockResolvedValue({ candidates: [], incomplete: false }) }));

const projectId = '11111111-1111-4111-8111-111111111111';
const providerId = '22222222-2222-4222-8222-222222222222';
const row = { project_id: projectId, provider_message_id: providerId, to_emails: ['customer@example.test'], created_at: '2026-09-17T00:00:00Z' };
function database(rows: unknown[], error: unknown = null) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), abortSignal: vi.fn() };
  for (const name of ['select', 'eq', 'order', 'limit'] as const) query[name].mockReturnValue(query);
  query.abortSignal.mockResolvedValue({ data: rows, error });
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}
const response = (recipients = row.to_emails) => new Response(JSON.stringify({ object: 'email', id: providerId, message_id: '<verified@example.test>', to: recipients }));

describe('authorized project send anchors', () => {
  it('skips repeated provider reads but rechecks canonical access before using saved proof', async () => {
    const db = database([row]);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response()));
    const dependencies = { apiKey: 'test', fetcher, cacheSecret: 'a'.repeat(64), cache: createVerifiedSendIdentityCache() };
    const signal = new AbortController().signal;
    await readProjectSendAnchors(db.client, projectId, signal, dependencies);
    expect((await readProjectSendAnchors(db.client, projectId, signal, dependencies)).anchors).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(db.from).toHaveBeenCalledTimes(4);
    db.query.abortSignal.mockResolvedValue({ data: [], error: { message: 'denied' } });
    expect(await readProjectSendAnchors(db.client, projectId, signal, dependencies)).toEqual({ anchors: [], incomplete: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reverifies a changed recipient instead of reusing an old match', async () => {
    const db = database([row]);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response()));
    const dependencies = { apiKey: 'test', fetcher, cacheSecret: 'a'.repeat(64), cache: createVerifiedSendIdentityCache() };
    const signal = new AbortController().signal;
    await readProjectSendAnchors(db.client, projectId, signal, dependencies);
    db.query.abortSignal.mockResolvedValue({ data: [{ ...row, to_emails: ['changed@example.test'] }], error: null });
    expect((await readProjectSendAnchors(db.client, projectId, signal, dependencies)).anchors).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not cache provider failures as either proof or a persistent empty result', async () => {
    const db = database([row]);
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockImplementation(() => Promise.resolve(response()));
    const dependencies = { apiKey: 'test', fetcher, cacheSecret: 'a'.repeat(64), cache: createVerifiedSendIdentityCache() };
    const signal = new AbortController().signal;
    expect((await readProjectSendAnchors(db.client, projectId, signal, dependencies)).incomplete).toBe(true);
    expect((await readProjectSendAnchors(db.client, projectId, signal, dependencies)).anchors).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('deduplicates canonical sends and checks project/status/provider before a read-only provider lookup', async () => {
    const db = database([row]);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response()));
    expect(await readProjectSendAnchors(db.client, projectId, new AbortController().signal, { apiKey: 'test', fetcher })).toEqual({
      anchors: [{ projectId, internetMessageId: '<verified@example.test>' }], incomplete: false,
    });
    expect(db.query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(db.query.eq).toHaveBeenCalledWith('status', 'SENT');
    expect(db.query.eq).toHaveBeenCalledWith('provider', 'resend');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
  });
  it('does not turn inaccessible or foreign project rows into provider reads', async () => {
    const fetcher = vi.fn();
    for (const db of [database([row], { message: 'denied' }), database([{ ...row, project_id: providerId }])]) {
      expect(await readProjectSendAnchors(db.client, projectId, new AbortController().signal, { apiKey: 'test', fetcher })).toEqual({ anchors: [], incomplete: true });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('leaves recipient mismatch unconfirmed', async () => {
    const db = database([row]);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response(['another@example.test'])));
    expect(await readProjectSendAnchors(db.client, projectId, new AbortController().signal, { apiKey: 'test', fetcher })).toEqual({ anchors: [], incomplete: true });
  });
  it('refuses conflicting canonical recipient evidence without provider lookup', async () => {
    const db = database([row, { ...row, to_emails: ['another@example.test'] }]);
    const fetcher = vi.fn();
    expect(await readProjectSendAnchors(db.client, projectId, new AbortController().signal, { apiKey: 'test', fetcher })).toEqual({ anchors: [], incomplete: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
