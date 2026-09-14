import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import type { DepositApproval } from '../xero/paymentApproval';
import type { PilotContext, PilotMatch, PilotReviewNote } from '../xero/pilotTypes';

const columns='id,tenant_id,receipt_id,invoice_id,project_id,payment_entry_id,amount_inc_gst_cents,receipt_date,approved_by,approved_at,reversed_at,evidence_fingerprint,source_kind,provider_invoice_id';
type Row = Record<string, unknown>;
function match(row: Row): PilotMatch {
  return { id:String(row.id),tenantId:String(row.tenant_id),receiptId:String(row.receipt_id),invoiceId:String(row.invoice_id),projectId:String(row.project_id),
    paymentEntryId:String(row.payment_entry_id),amountCents:Number(row.amount_inc_gst_cents),receiptDate:String(row.receipt_date),
    approvedBy:String(row.approved_by),approvedAt:String(row.approved_at),reversedAt:row.reversed_at ? String(row.reversed_at) : null,evidenceFingerprint:String(row.evidence_fingerprint),
    sourceKind:row.source_kind as PilotMatch['sourceKind'],providerInvoiceId:row.provider_invoice_id ? String(row.provider_invoice_id) : null };
}
function unavailable(error: unknown): never {
  const message=(error as {message?:string})?.message??'';
  if (/permission is required/.test(message)) throw new Error('PAYMENT_APPROVAL_FORBIDDEN');
  if (/evidence changed|different evidence|reversed; review/.test(message)) throw new Error('APPROVAL_EVIDENCE_CHANGED');
  if (/already recorded/.test(message)) throw new Error('RECEIPT_ALREADY_RECORDED');
  if (/Existing payment history|exceed the remaining|already been allocated|not an open NZD/.test(message)) throw new Error('PAYMENT_RECONCILIATION_REQUIRED');
  throw new Error('PAYMENT_REVIEW_UNAVAILABLE');
}
export async function hasPaymentApprovalGrant(userId:string):Promise<boolean> {
  const result=await supabaseServiceRole.from('xero_payment_approvers').select('user_id').eq('user_id',userId).is('revoked_at',null).maybeSingle();
  if(result.error) unavailable(result.error); return Boolean(result.data);
}
export async function invoiceIdForReview(invoiceRef:string):Promise<string> {
  const result=await supabaseServiceRole.from('deposit_invoices').select('id').eq('invoice_ref',invoiceRef).limit(2);
  if(result.error) unavailable(result.error);
  if(!result.data?.length) throw new Error('INVOICE_NOT_FOUND');
  if(result.data.length!==1) throw new Error('AMBIGUOUS_INVOICE');
  return result.data[0].id;
}
export async function loadPilotContext(invoiceId:string):Promise<PilotContext> {
  const result=await supabaseServiceRole.rpc('xero_deposit_review_context',{p_invoice_id:invoiceId});
  if(result.error) unavailable(result.error);
  const data=result.data as PilotContext | null;
  if(!data?.invoice || data.invoice.id!==invoiceId || !Number.isSafeInteger(data.invoice.totalIncGstCents)
    || !Number.isSafeInteger(data.matchedCents) || typeof data.customerWon!=='boolean' || typeof data.hasUnmatchedPaymentHistory!=='boolean'
    || !/^[a-f0-9]{64}$/.test(data.invoiceFingerprint) || !/^[a-f0-9]{64}$/.test(data.ledgerFingerprint)) throw new Error('PAYMENT_REVIEW_UNAVAILABLE');
  return data;
}
export async function findPilotMatch(approvalId:string):Promise<PilotMatch|null> {
  const result=await supabaseServiceRole.from('xero_deposit_matches').select(columns).eq('id',approvalId).maybeSingle();
  if(result.error) unavailable(result.error); return result.data ? match(result.data) : null;
}
export async function listPilotMatches(invoiceId:string):Promise<PilotMatch[]> {
  const result=await supabaseServiceRole.from('xero_deposit_matches').select(columns).eq('invoice_id',invoiceId).order('approved_at',{ascending:false}).limit(100);
  if(result.error) unavailable(result.error); return (result.data??[]).map(match);
}
export async function activeReceiptMatches(tenantId:string,receiptIds:string[]):Promise<PilotMatch[]> {
  if(!receiptIds.length) return [];
  const result=await supabaseServiceRole.from('xero_deposit_matches').select(columns).eq('tenant_id',tenantId).in('receipt_id',receiptIds).is('reversed_at',null);
  if(result.error) unavailable(result.error); return (result.data??[]).map(match);
}
export async function commitPilotMatch(approval:DepositApproval,reference:string) {
  const e=approval.evidence;
  const result=await supabaseServiceRole.rpc('xero_approve_deposit_match',{
    p_approval_id:approval.approvalId,p_actor:approval.approverId,p_tenant_id:e.tenantId,p_receipt_id:e.receiptId,p_contact_id:e.contactId,
    p_project_id:e.projectId,p_invoice_id:e.invoiceId,p_amount_cents:e.amountCents,p_receipt_date:e.receiptDate,
    p_invoice_fingerprint:e.invoiceFingerprint,p_ledger_fingerprint:e.ledgerFingerprint,p_evidence_fingerprint:e.receiptFingerprint,p_reference:reference,
  });
  if(result.error) unavailable(result.error);
  if(!result.data || typeof (result.data as {matchId?:unknown}).matchId!=='string') throw new Error('PAYMENT_REVIEW_UNAVAILABLE');
  return result.data as {matchId:string;paymentEntryId:string;replayed:boolean};
}
export async function reversePilotMatch(matchId:string,reason:string,actor:string):Promise<void> {
  const found=await findPilotMatch(matchId);
  if(!found) throw new Error('MATCH_NOT_FOUND');
  const result=await supabaseServiceRole.rpc('commercial_reverse_payment_entry_with_project_lock',{
    p_payment_entry_id:found.paymentEntryId,p_reason:reason,p_actor:actor,
  });
  if(result.error) unavailable(result.error);
}
export async function listPilotReviewNotes(invoiceId:string):Promise<PilotReviewNote[]> {
  const result=await supabaseServiceRole.from('xero_deposit_review_notes').select('id,receipt_id,disposition,reason,recorded_at').eq('invoice_id',invoiceId).order('recorded_at',{ascending:false}).limit(100);
  if(result.error) unavailable(result.error);
  return (result.data??[]).map(row=>({id:row.id,receiptId:row.receipt_id,disposition:row.disposition as PilotReviewNote['disposition'],reason:row.reason,recordedAt:row.recorded_at}));
}
export async function recordPilotReviewNote(id:string,actor:string,tenantId:string,receiptId:string,invoiceId:string,disposition:PilotReviewNote['disposition'],reason:string):Promise<void> {
  const result=await supabaseServiceRole.rpc('xero_record_deposit_review_note',{p_id:id,p_actor:actor,p_tenant_id:tenantId,p_receipt_id:receiptId,p_invoice_id:invoiceId,p_disposition:disposition,p_reason:reason});
  if(result.error) unavailable(result.error);
}
