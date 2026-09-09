import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prepareResendEmailMessage } from '@sp/email-provider';
import type { EnquiryPayload } from '@/emails/types';
import { dispatchEnquiryAutoresponder } from './enquiryEmailDelivery';
import { recordEnquiryEmailAudit } from './enquiryEmailAudit';
import { EmailDeliveryError } from './sendEmail';

const h = vi.hoisted(() => ({ prepare: vi.fn(), send: vi.fn() }));
vi.mock('./sendCustomerAutoresponder', () => ({ prepareCustomerAutoresponder: h.prepare }));
vi.mock('./sendEmail', async (original) => ({ ...await original<typeof import('./sendEmail')>(), sendEmail: h.send }));
const enquiry = { leadId: '11111111-1111-4111-8111-111111111111' } as EnquiryPayload;
const options = { submissionId: '22222222-2222-4222-8222-222222222222' };

function database(begin: unknown = true, receiptError = false) {
  const calls: string[] = [];
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => {
    calls.push(name);
    return name.endsWith('_begin') ? { data: begin, error: null } : { data: null, error: receiptError ? { message: 'private database detail' } : null };
  });
  return { rpc, calls, client: { rpc } as unknown as SupabaseClient };
}

describe('request-bound enquiry dispatch', () => {
  beforeEach(() => {
    h.prepare.mockReset().mockImplementation(async (_enquiry, input) => prepareResendEmailMessage({
      from: 'info@example.test', to: 'customer@example.test', subject: 'Test', text: 'Test', enquiryReference: input.enquiryReference,
    }));
    h.send.mockReset().mockResolvedValue({ provider: 'resend', providerMessageId: 'api-message-1' });
  });

  it('binds canonical identity and final hash before one send, then saves API acceptance', async () => {
    const db = database();
    h.send.mockImplementation(async () => {
      expect(db.calls).toEqual(['marketing_enquiry_email_begin']);
      return { provider: 'resend', providerMessageId: 'api-message-1' };
    });
    const result = await dispatchEnquiryAutoresponder(db.client, enquiry, options);
    const prepared = await h.prepare.mock.results[0].value;
    expect(db.rpc.mock.calls[0]).toEqual(['marketing_enquiry_email_begin', expect.objectContaining({
      p_enquiry_request_id: enquiry.leadId, p_submission_id: options.submissionId, p_payload_hash: prepared.payloadHash,
    })]);
    expect(h.send).toHaveBeenCalledExactlyOnceWith({ ...prepared.message, idempotencyKey: `website:autoresponder:${enquiry.leadId}` });
    expect(db.rpc.mock.calls[1]).toEqual(['marketing_enquiry_email_record', expect.objectContaining({ p_outcome: 'accepted', p_provider_api_message_id: 'api-message-1', p_payload_hash: prepared.payloadHash })]);
    expect(result).toMatchObject({ outcome: 'accepted', providerApiMessageId: 'api-message-1' });
    expect(result).not.toHaveProperty('rfcMessageId');
  });

  it('omits the fresh reference for a confirmed duplicate and never sends', async () => {
    const db = database(false);
    const result = await dispatchEnquiryAutoresponder(db.client, enquiry, options);
    expect(result).toMatchObject({ outcome: 'unknown' });
    expect(result).not.toHaveProperty('enquiryReference');
    expect(h.send).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it.each(['thrown', 'returned-error', 'null', 'malformed'] as const)(
    'retains the attempted lookup reference after %s uncertainty without sending', async (failure) => {
      const db = database();
      db.rpc.mockImplementationOnce(async () => {
        if (failure === 'thrown') throw new Error('lost intent response');
        return { data: failure === 'malformed' ? 'true' : null,
          error: failure === 'returned-error' ? { message: 'lost intent response' } : null };
      });
      const result = await dispatchEnquiryAutoresponder(db.client, enquiry, options);
      const attempted = `sp_enq_${db.rpc.mock.calls[0]?.[1].p_reference}`;
      expect(result).toEqual({ outcome: 'unknown', code: 'ENQUIRY_EMAIL_INTENT_NOT_CLAIMED',
        enquiryReference: attempted, providerApiMessageId: null });
      expect(h.send).not.toHaveBeenCalled();
      expect(db.rpc).toHaveBeenCalledTimes(1);

      const upsert = vi.fn().mockResolvedValue({ error: null });
      const from = vi.fn().mockReturnValue({ upsert });
      await recordEnquiryEmailAudit({ from } as unknown as SupabaseClient, {
        projectId: 'project', contactId: 'contact', email: 'customer@example.test', subject: 'Test',
        templateId: 'template', emailType: 'WEBSITE_ESTIMATE_AUTORESPONDER',
        idempotencyKey: `website:autoresponder:${enquiry.leadId}`, variables: {}, delivery: result,
      });
      expect(from).toHaveBeenCalledExactlyOnceWith('audit_events');
      expect(upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        type: 'email_outcome_unknown', payload: expect.objectContaining({
          outcome: 'unknown', enquiryReference: attempted, providerApiMessageId: null,
        }),
      }), { onConflict: 'idempotency_key' });
    },
  );

  it('does not send after preparation or intent persistence failure', async () => {
    const db = database();
    h.prepare.mockRejectedValueOnce(new Error('render failed'));
    expect(await dispatchEnquiryAutoresponder(db.client, enquiry, options)).toMatchObject({ outcome: 'failed' });
    expect(db.rpc).not.toHaveBeenCalled();
    db.rpc.mockRejectedValueOnce(new Error('lost intent response'));
    expect(await dispatchEnquiryAutoresponder(db.client, enquiry, options)).toMatchObject({ outcome: 'unknown' });
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([
    ['RESEND_TIMEOUT', 'uncertain', 'unknown'],
    ['RESEND_NETWORK_ERROR', 'uncertain', 'unknown'],
    ['RESEND_RESPONSE_INVALID', 'uncertain', 'unknown'],
    ['RESEND_SERVER_ERROR', 'uncertain', 'unknown'],
    ['RESEND_IDEMPOTENCY_IN_PROGRESS', 'retryable_rejection', 'unknown'],
    ['RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT', 'idempotency_conflict', 'unknown'],
    ['RESEND_AUTH_REJECTED', 'terminal_rejection', 'failed'],
    ['RESEND_RATE_LIMITED', 'retryable_rejection', 'failed'],
    ['RESEND_ABORTED_BEFORE_DISPATCH', 'not_dispatched', 'failed'],
  ] as const)('records %s as %s without retry', async (code, outcome, expected) => {
    const db = database();
    h.send.mockRejectedValue(new EmailDeliveryError({ code, outcome, statusCode: null }));
    expect(await dispatchEnquiryAutoresponder(db.client, enquiry, options)).toMatchObject({ outcome: expected, code, providerApiMessageId: null });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('keeps unknown after accepted response followed by receipt-write failure; never resends or overwrites', async () => {
    const db = database(true, true);
    expect(await dispatchEnquiryAutoresponder(db.client, enquiry, options)).toMatchObject({ outcome: 'unknown', code: 'ENQUIRY_EMAIL_RECEIPT_WRITE_FAILED', providerApiMessageId: null });
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(db.rpc.mock.calls[1]?.[1]).toMatchObject({ p_outcome: 'accepted', p_provider_api_message_id: 'api-message-1' });
  });
});
