import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const auditSchema = z.object({ project_id: z.uuid(), idempotency_key: z.string(), created_at: z.string(),
  payload: z.object({ outboxId: z.uuid(), providerMessageId: z.uuid() }) });
const outboxSchema = z.object({ id: z.uuid(), project_id: z.uuid(), to_email: z.email(), status: z.literal('SENT') });

/** The durable producer records the provider identity in its audit event, not the outbox row. */
export async function readEnquirySendEvidence(client: SupabaseClient, projectId: string, signal: AbortSignal) {
  const candidates: { project_id: string; provider_message_id: string; to_emails: string[]; created_at: string }[] = [];
  let incomplete = false;
  try {
    const audit = await client.from('audit_events').select('project_id,idempotency_key,created_at,payload')
      .eq('project_id', projectId).eq('type', 'email_sent').like('idempotency_key', 'audit:website:delivery:%')
      .order('created_at', { ascending: false }).limit(9).abortSignal(signal);
    if (audit.error) return { candidates, incomplete: true };
    const records: z.infer<typeof auditSchema>[] = [];
    for (const value of audit.data ?? []) {
      const record = auditSchema.safeParse(value);
      if (!record.success || record.data.project_id !== projectId ||
        record.data.idempotency_key !== `audit:website:delivery:${record.data.payload.outboxId}`) { incomplete = true; continue; }
      records.push(record.data);
    }
    if (!records.length) return { candidates, incomplete };
    const outbox = await client.from('email_outbox').select('id,project_id,to_email,status')
      .eq('project_id', projectId).eq('status', 'SENT').in('id', records.map(record => record.payload.outboxId))
      .limit(9).abortSignal(signal);
    if (outbox.error) return { candidates, incomplete: true };
    const rows = (outbox.data ?? []).map(value => outboxSchema.safeParse(value));
    for (const record of records) {
      const matches = rows.filter(row => row.success && row.data.project_id === projectId && row.data.id === record.payload.outboxId);
      if (matches.length !== 1 || !matches[0].success) { incomplete = true; continue; }
      candidates.push({ project_id: projectId, provider_message_id: record.payload.providerMessageId,
        to_emails: [matches[0].data.to_email], created_at: record.created_at });
    }
    return { candidates, incomplete };
  } catch {
    return { candidates: [], incomplete: true };
  }
}
