import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseEmailEnquiryReference, type EmailEnquiryReference } from '@sp/email-provider';
import type { EnquiryPayload } from '@/emails/types';
import { prepareCustomerAutoresponder } from './sendCustomerAutoresponder';
import { getEmailDeliveryFailureSummary, sendEmail } from './sendEmail';

export type EnquiryEmailDelivery = Readonly<{
  outcome: 'accepted' | 'failed' | 'unknown';
  code: string;
  enquiryReference?: EmailEnquiryReference;
  providerApiMessageId: string | null;
}>;

export async function dispatchEnquiryAutoresponder(
  supabase: SupabaseClient,
  enquiry: EnquiryPayload,
  options: {
    submissionId: string;
    attachments?: { filename: string; content: string; contentType?: string }[];
  },
): Promise<EnquiryEmailDelivery> {
  const reference = randomUUID();
  const enquiryReference = parseEmailEnquiryReference(`sp_enq_${reference}`);
  let prepared: Awaited<ReturnType<typeof prepareCustomerAutoresponder>>;
  try {
    prepared = await prepareCustomerAutoresponder(enquiry, { attachments: options.attachments, enquiryReference });
  } catch {
    return { outcome: 'failed', code: 'ENQUIRY_EMAIL_PREPARATION_FAILED', providerApiMessageId: null };
  }

  try {
    const result = await supabase.rpc('marketing_enquiry_email_begin', {
      p_reference: reference,
      p_enquiry_request_id: enquiry.leadId,
      p_submission_id: options.submissionId,
      p_payload_hash: prepared.payloadHash,
    });
    if (result.error || result.data !== true) {
      return { outcome: 'unknown', code: 'ENQUIRY_EMAIL_INTENT_NOT_CLAIMED', providerApiMessageId: null };
    }
  } catch {
    return { outcome: 'unknown', code: 'ENQUIRY_EMAIL_INTENT_NOT_CLAIMED', providerApiMessageId: null };
  }

  let delivery: EnquiryEmailDelivery;
  try {
    // The frozen normalized message hashes to the same wire bytes in dispatchLegacy.
    const accepted = await sendEmail({
      ...prepared.message,
      idempotencyKey: `website:autoresponder:${enquiry.leadId}`,
    });
    delivery = { outcome: 'accepted', code: 'RESEND_ACCEPTED', enquiryReference, providerApiMessageId: accepted.providerMessageId };
  } catch (error) {
    const failure = getEmailDeliveryFailureSummary(error);
    const definiteFailure = failure.outcome === 'terminal_rejection'
      || failure.outcome === 'not_dispatched'
      || failure.outcome === 'configuration_error'
      || failure.code === 'RESEND_RATE_LIMITED';
    delivery = {
      outcome: definiteFailure ? 'failed' : 'unknown',
      code: failure.code,
      enquiryReference,
      providerApiMessageId: null,
    };
  }

  try {
    const receipt = await supabase.rpc('marketing_enquiry_email_record', {
      p_reference: reference,
      p_payload_hash: prepared.payloadHash,
      p_outcome: delivery.outcome,
      p_provider_api_message_id: delivery.providerApiMessageId,
      p_code: delivery.code,
    });
    if (receipt.error) throw new Error('ENQUIRY_EMAIL_RECEIPT_WRITE_FAILED');
  } catch {
    // The receipt may have committed. Do not overwrite it, retry delivery, or claim failure.
    return { outcome: 'unknown', code: 'ENQUIRY_EMAIL_RECEIPT_WRITE_FAILED', enquiryReference, providerApiMessageId: null };
  }
  return delivery;
}
