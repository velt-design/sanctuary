import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readProjectSendAnchors } from './projectSendAnchors';
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
