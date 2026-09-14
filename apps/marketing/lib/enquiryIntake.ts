import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailMessageInput } from '@sp/email-provider';

export type EnquiryDelivery = {
  draftEstimate: Record<string, unknown>;
  message: EmailMessageInput;
  templateId: string;
  emailType: string;
  variables: Record<string, unknown>;
};

type MarketingEnquiryIntakeResult = {
  contactId: string;
  projectId: string;
  enquiryRequestId: string;
  alreadyExisted: boolean;
  estimateId: string | null;
};

export class MarketingEnquiryIntakeError extends Error {
  constructor() {
    super('ENQUIRY_INTAKE_FAILED');
    this.name = 'MarketingEnquiryIntakeError';
  }
}

function sha256(value: string): string {
  return value ? createHash('sha256').update(value).digest('hex') : '';
}

export async function createMarketingEnquiryIntake(
  supabase: SupabaseClient,
  params: {
    submissionId: string;
    uploadSessionToken: string;
    payload: Record<string, unknown>;
    delivery?: EnquiryDelivery;
  },
): Promise<MarketingEnquiryIntakeResult> {
  const { data, error } = await supabase.rpc(params.delivery ? 'marketing_enquiry_intake_with_delivery' : 'marketing_enquiry_intake', {
    p_submission_id: params.submissionId,
    p_upload_token_hash: sha256(params.uploadSessionToken),
    p_payload: params.payload,
    ...(params.delivery ? { p_delivery: params.delivery } : {}),
  });
  if (error) throw new MarketingEnquiryIntakeError();

  const row = Array.isArray(data) ? data[0] : data;
  const contactId = typeof row?.contact_id === 'string' ? row.contact_id : '';
  const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
  const enquiryRequestId = typeof row?.enquiry_request_id === 'string' ? row.enquiry_request_id : '';
  if (!contactId || !projectId || !enquiryRequestId) throw new MarketingEnquiryIntakeError();
  const estimateId = typeof row?.estimate_id === 'string' ? row.estimate_id : null;
  if (params.delivery && !estimateId) throw new MarketingEnquiryIntakeError();

  return {
    contactId,
    projectId,
    enquiryRequestId,
    alreadyExisted: row?.already_existed === true,
    estimateId,
  };
}
