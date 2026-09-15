import 'server-only';
import { activeReceiptMatches, commitPilotMatch, findPilotMatch, invoiceIdForReview, listPilotMatches, listPilotReviewNotes, loadPilotContext } from '../invoices/xeroMatchRepository';
import { assertApprovalEvidenceUnchanged, evidenceFingerprint, prepareDepositApproval, readDepositApproval, type DepositEvidence } from './paymentApproval';
import { suggestDepositMatches } from './paymentSuggestions';
import type { PilotContext, PilotReview, VerifiedReceipt } from './pilotTypes';
import { reviewQuery } from './review';
import { config } from './security';
import { readAccounting } from './store';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function receiptFingerprint(receipt:VerifiedReceipt):string {
  return evidenceFingerprint({id:receipt.id,contactId:receipt.contactId,contact:receipt.contact,reference:receipt.reference,
    transactionType:receipt.transactionType,status:receipt.status,date:receipt.date,total:receipt.total,currency:receipt.currency,
    reconciled:receipt.reconciled,updatedAt:receipt.updatedAt});
}
function inspect(context:PilotContext,receipts:VerifiedReceipt[]) {
  const suggestions=suggestDepositMatches(context.invoice,context.hasUnmatchedPaymentHistory?[{id:'existing'}]:[],receipts,context.matchedCents);
  return suggestions.map((suggestion,index)=>{
    const receipt=receipts[index];
    if(!uuid.test(receipt.id)||!uuid.test(receipt.contactId)||receipt.transactionType!=='RECEIVE'||!receipt.updatedAt)
      suggestion.blockers.push('Xero receipt identity or verification details are incomplete.');
    if(context.invoice.currency!=='NZD') suggestion.blockers.push('Portal invoice currency is not NZD.');
    suggestion.assessment=suggestion.blockers.length?'blocked':'review';
    if(suggestion.blockers.length) { suggestion.customerWonIfApproved=false; suggestion.depositRemainingIfApprovedCents=null; }
    return suggestion;
  });
}
function evidence(context:PilotContext,receipt:VerifiedReceipt,tenantId:string):DepositEvidence {
  return { tenantId,receiptId:receipt.id,contactId:receipt.contactId,projectId:context.invoice.projectId,invoiceId:context.invoice.id,
    amountCents:Math.round(receipt.total!*100),receiptDate:receipt.date.slice(0,10),invoiceTotalCents:context.invoice.totalIncGstCents,
    invoiceFingerprint:context.invoiceFingerprint,ledgerFingerprint:context.ledgerFingerprint,receiptFingerprint:receiptFingerprint(receipt) };
}
export async function reviewPilotDeposit(invoiceRef:string,contactName:string,approverId:string):Promise<PilotReview> {
  const cfg=config();
  const context=await loadPilotContext(await invoiceIdForReview(invoiceRef));
  const query=reviewQuery('receipt',contactName.trim()||context.invoice.customerName||'');
  const receipts=await readAccounting(query.resource,query.where);
  const [active,matches,notes]=await Promise.all([activeReceiptMatches(cfg.tenantId,receipts.map(r=>r.id).filter(id=>uuid.test(id))),listPilotMatches(context.invoice.id),listPilotReviewNotes(context.invoice.id)]);
  const suggestions=inspect(context,receipts).map((suggestion,index)=>{
    const existing=active.find(match=>match.receiptId===suggestion.receipt.id);
    if(existing) {
      suggestion.blockers.push(existing.invoiceId===context.invoice.id?'This receipt is already recorded against this invoice.':'This receipt is already recorded against another invoice.');
      suggestion.assessment='blocked'; suggestion.customerWonIfApproved=false; suggestion.depositRemainingIfApprovedCents=null;
    }
    let approvalToken:string|null=null; let approvalId:string|null=null;
    if(!suggestion.blockers.length) {
      approvalToken=prepareDepositApproval(evidence(context,receipts[index],cfg.tenantId),approverId,cfg.key);
      approvalId=readDepositApproval(approvalToken,approverId,cfg.tenantId,cfg.key).approvalId;
    }
    return {...suggestion,approvalToken,approvalId};
  });
  return {context,suggestions,matches,notes,checkedAt:new Date().toISOString(),limited:receipts.length===20||matches.length===100||notes.length===100};
}
export async function approvePilotDeposit(token:string,approverId:string) {
  const cfg=config();
  const approval=readDepositApproval(token,approverId,cfg.tenantId,cfg.key);
  if (approval.evidence.invoicePayment) throw new Error('APPROVAL_REVIEW_REQUIRED');
  // A committed receipt is authoritative after a lost response. Its own write
  // changed the reviewed ledger; never reject that successful retry as stale.
  const previous=await findPilotMatch(approval.approvalId);
  if(previous) {
    if (previous.sourceKind === 'INVOICE_PAYMENT') throw new Error('APPROVAL_EVIDENCE_CHANGED');
    if(previous.approvedBy!==approverId || previous.tenantId!==approval.evidence.tenantId || previous.receiptId!==approval.evidence.receiptId
      || previous.invoiceId!==approval.evidence.invoiceId || previous.projectId!==approval.evidence.projectId
      || previous.amountCents!==approval.evidence.amountCents || previous.evidenceFingerprint!==approval.evidence.receiptFingerprint) throw new Error('APPROVAL_EVIDENCE_CHANGED');
    if(previous.reversedAt) throw new Error('MATCH_REVERSED');
    return {matchId:previous.id,paymentEntryId:previous.paymentEntryId,replayed:true};
  }
  const context=await loadPilotContext(approval.evidence.invoiceId);
  const receipts=await readAccounting('BankTransactions','',approval.evidence.receiptId);
  if(receipts.length!==1||receipts[0].id!==approval.evidence.receiptId) throw new Error('APPROVAL_EVIDENCE_CHANGED');
  const receipt=receipts[0];
  if(inspect(context,[receipt])[0].blockers.length) throw new Error('APPROVAL_EVIDENCE_CHANGED');
  assertApprovalEvidenceUnchanged(approval,evidence(context,receipt,cfg.tenantId));
  // Database command compares the reviewed fingerprints once more under its
  // lock, closing the gap between the external read and the actual ledger write.
  return commitPilotMatch(approval,receipt.reference);
}
