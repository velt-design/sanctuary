import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordEnquiryEmailAudit } from './enquiryEmailAudit';

describe('enquiry email compatibility audit', () => {
  it('retains provider acceptance when outbox persistence fails and records a logging failure', async () => {
    const writes: { table: string; row: Record<string, unknown> }[] = [];
    const client = { from: (table: string) => ({ upsert: async (row: Record<string, unknown>) => {
      writes.push({ table, row });
      return { error: table === 'email_outbox' ? { message: 'private failure detail' } : null };
    } }) } as unknown as SupabaseClient;
    const delivery = Object.freeze({ outcome: 'accepted' as const, code: 'RESEND_ACCEPTED', providerApiMessageId: 'api-1' });
    await recordEnquiryEmailAudit(client, { projectId: 'project-1', contactId: 'contact-1', email: 'customer@example.test', subject: 'Hello', templateId: 'template-1', emailType: 'WEBSITE_ESTIMATE_AUTORESPONDER', idempotencyKey: 'website:autoresponder:enquiry-1', variables: {}, delivery });
    expect(delivery.outcome).toBe('accepted');
    expect(writes.at(-1)).toMatchObject({ table: 'audit_events', row: { type: 'email_log_failed', payload: { outcome: 'accepted', providerApiMessageId: 'api-1' } } });
    expect(JSON.stringify(writes)).not.toContain('private failure detail');
  });
});
