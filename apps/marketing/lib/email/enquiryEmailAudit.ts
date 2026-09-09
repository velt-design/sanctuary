import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnquiryEmailDelivery } from './enquiryEmailDelivery';

/** Compatibility display records; private intent/receipt remains authoritative. */
export async function recordEnquiryEmailAudit(supabase: SupabaseClient, input: {
  projectId: string;
  contactId: string;
  email: string;
  subject: string;
  templateId: string;
  emailType: string;
  idempotencyKey: string;
  variables: Record<string, unknown>;
  delivery: EnquiryEmailDelivery;
}): Promise<void> {
  const { delivery } = input;
  const nowIso = new Date().toISOString();
  const payload = {
    to: input.email, subject: input.subject, templateId: input.templateId, kind: input.emailType,
    outcome: delivery.outcome, code: delivery.code,
    enquiryReference: delivery.enquiryReference ?? null,
    providerApiMessageId: delivery.providerApiMessageId,
  };
  try {
    // The legacy outbox has no unknown state. Never label uncertainty as SENT or FAILED.
    if (delivery.outcome !== 'unknown') {
      const seed = await supabase.from('email_templates').upsert({
        id: input.templateId, subject: input.subject,
        body_html: '<p>(Rendered in app code)</p>', body_text: null, variables: [],
      }, { onConflict: 'id' });
      if (seed.error) throw new Error('EMAIL_TEMPLATE_WRITE_FAILED');
      const outbox = await supabase.from('email_outbox').upsert({
        project_id: input.projectId, contact_id: input.contactId, email_type: input.emailType,
        to_email: input.email, subject: input.subject, template_id: input.templateId,
        variables: { ...input.variables, ...(delivery.enquiryReference ? { enquiryReference: delivery.enquiryReference } : {}) },
        status: delivery.outcome === 'accepted' ? 'SENT' : 'FAILED',
        error: delivery.outcome === 'failed' ? delivery.code : null,
        idempotency_key: input.idempotencyKey,
        sent_at: delivery.outcome === 'accepted' ? nowIso : null,
      }, { onConflict: 'idempotency_key' });
      if (outbox.error) throw new Error('EMAIL_OUTBOX_WRITE_FAILED');
    }
    const audit = await supabase.from('audit_events').upsert({
      project_id: input.projectId,
      type: delivery.outcome === 'accepted' ? 'email_sent' : delivery.outcome === 'failed' ? 'email_failed' : 'email_outcome_unknown',
      idempotency_key: `audit:${input.idempotencyKey}`, payload, created_at: nowIso,
    }, { onConflict: 'idempotency_key' });
    if (audit.error) throw new Error('EMAIL_AUDIT_WRITE_FAILED');
  } catch {
    console.error('Failed to log autoresponder compatibility records', { code: 'EMAIL_OUTBOX_AUDIT_WRITE_FAILED' });
    try {
      const fallback = await supabase.from('audit_events').upsert({
        project_id: input.projectId, type: 'email_log_failed',
        idempotency_key: `audit:${input.idempotencyKey}:log_failed`,
        payload: { ...payload, loggingCode: 'EMAIL_OUTBOX_AUDIT_WRITE_FAILED' }, created_at: nowIso,
      }, { onConflict: 'idempotency_key' });
      if (fallback.error) throw new Error('EMAIL_AUDIT_FALLBACK_WRITE_FAILED');
    } catch {
      console.error('Failed to log autoresponder audit fallback', { code: 'EMAIL_AUDIT_FALLBACK_WRITE_FAILED' });
    }
  }
}
