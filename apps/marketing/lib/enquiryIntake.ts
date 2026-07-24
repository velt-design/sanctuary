import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type MarketingEnquiryIntakeResult = {
  contactId: string;
  projectId: string;
  enquiryRequestId: string;
  alreadyExisted: boolean;
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
  },
): Promise<MarketingEnquiryIntakeResult> {
  const { data, error } = await supabase.rpc('marketing_enquiry_intake', {
    p_submission_id: params.submissionId,
    p_upload_token_hash: sha256(params.uploadSessionToken),
    p_payload: params.payload,
  });
  if (error) throw new MarketingEnquiryIntakeError();

  const row = Array.isArray(data) ? data[0] : data;
  const contactId = typeof row?.contact_id === 'string' ? row.contact_id : '';
  const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
  const enquiryRequestId = typeof row?.enquiry_request_id === 'string' ? row.enquiry_request_id : '';
  if (!contactId || !projectId || !enquiryRequestId) throw new MarketingEnquiryIntakeError();

  return {
    contactId,
    projectId,
    enquiryRequestId,
    alreadyExisted: row?.already_existed === true,
  };
}
