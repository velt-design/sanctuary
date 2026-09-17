import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnquirySendEvidence } from './enquirySendEvidence';
const projectId = '11111111-1111-4111-8111-111111111111';
const outboxId = '22222222-2222-4222-8222-222222222222';
const providerId = '33333333-3333-4333-8333-333333333333';
const audit = { project_id: projectId, created_at: '2026-09-17T00:00:00Z', idempotency_key: `audit:website:delivery:${outboxId}`,
  payload: { outboxId, providerMessageId: providerId } };
const outbox = { id: outboxId, project_id: projectId, status: 'SENT', to_email: 'customer@example.test' };
function database(events: unknown[], messages: unknown[]) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'like', 'order', 'limit', 'in']) query[method] = vi.fn().mockReturnValue(query);
  query.abortSignal = vi.fn().mockResolvedValueOnce({ data: events }).mockResolvedValueOnce({ data: messages });
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}
describe('enquiry send evidence', () => {
  it('joins the durable audit identity to a sent outbox row for the same project', async () => {
    const db = database([audit], [outbox]);
    expect(await readEnquirySendEvidence(db.client, projectId, new AbortController().signal)).toEqual({ candidates: [{
      project_id: projectId, provider_message_id: providerId, to_emails: [outbox.to_email], created_at: audit.created_at,
    }], incomplete: false });
    expect(db.query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(db.query.in).toHaveBeenCalledWith('id', [outboxId]);
  });
  it.each([
    { ...outbox, project_id: providerId }, { ...outbox, status: 'FAILED' }, { ...outbox, id: providerId },
  ])('rejects mismatched or unsent outbox evidence', async message => {
    const db = database([audit], [message]);
    expect(await readEnquirySendEvidence(db.client, projectId, new AbortController().signal)).toEqual({ candidates: [], incomplete: true });
  });
  it('does not interpret arbitrary manual email events as durable send evidence', async () => {
    const db = database([{ ...audit, idempotency_key: 'manual-event' }], [outbox]);
    expect(await readEnquirySendEvidence(db.client, projectId, new AbortController().signal)).toEqual({ candidates: [], incomplete: true });
    expect(db.from).not.toHaveBeenCalledWith('email_outbox');
  });
  it('reports unavailable database evidence without exposing errors', async () => {
    const db = database([], []);
    db.query.abortSignal.mockReset().mockRejectedValue(new Error('private details'));
    expect(await readEnquirySendEvidence(db.client, projectId, new AbortController().signal)).toEqual({ candidates: [], incomplete: true });
  });
});
