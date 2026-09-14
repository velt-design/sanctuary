import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PilotContext, VerifiedReceipt } from './pilotTypes';
import { readDepositApproval } from './paymentApproval';
const db = vi.hoisted(() => ({ activeReceiptMatches:vi.fn(), commitPilotMatch:vi.fn(), findPilotMatch:vi.fn(), invoiceIdForReview:vi.fn(), listPilotMatches:vi.fn(), listPilotReviewNotes:vi.fn(), loadPilotContext:vi.fn() }));
const accounting = vi.hoisted(() => vi.fn());
vi.mock('../invoices/xeroMatchRepository', () => db);
vi.mock('./store', () => ({readAccounting:accounting}));
vi.mock('./security', async original => ({...await original<typeof import('./security')>(), config:() => ({tenantId:'11111111-1111-4111-8111-111111111111',key:Buffer.alloc(32,6)})}));
import { approvePilotDeposit, reviewPilotDeposit } from './paymentPilot';
const id='11111111-1111-4111-8111-111111111111';
const receiptId='22222222-2222-4222-8222-222222222222';
const context:PilotContext={invoice:{id,projectId:id,invoiceRef:'INV-0001',status:'OPEN',invoiceKind:'QUOTE_LINKED',paymentTermPosition:1,customerName:'Example Customer',projectName:'Example Project',totalIncGstCents:10000,reference:'',currency:'NZD'},invoiceFingerprint:'a'.repeat(64),ledgerFingerprint:'b'.repeat(64),matchedCents:0,customerWon:false,hasUnmatchedPaymentHistory:false};
const receipt:VerifiedReceipt={id:receiptId,contactId:id,contact:'Example Customer',reference:'',status:'AUTHORISED',date:'2026-09-01',total:40,currency:'NZD',reconciled:true,transactionType:'RECEIVE',updatedAt:'2026-09-02T00:00:00Z'};
beforeEach(()=>{
  vi.resetAllMocks();
  db.invoiceIdForReview.mockResolvedValue(id); db.loadPilotContext.mockResolvedValue(structuredClone(context));
  db.activeReceiptMatches.mockResolvedValue([]);db.listPilotMatches.mockResolvedValue([]);db.listPilotReviewNotes.mockResolvedValue([]);db.findPilotMatch.mockResolvedValue(null);
  db.commitPilotMatch.mockResolvedValue({matchId:id,paymentEntryId:id,replayed:false}); accounting.mockResolvedValue([structuredClone(receipt)]);
});
async function proposed(){return (await reviewPilotDeposit('INV-0001','',id)).suggestions[0];}
describe('deposit pilot evidence and retry boundary',()=>{
  it('re-reads the exact receipt and records only the approved partial amount',async()=>{
    const proposal=await proposed();
    expect(proposal.depositRemainingIfApprovedCents).toBe(6000);
    expect(proposal.customerWonIfApproved).toBe(true);
    await approvePilotDeposit(proposal.approvalToken!,id);
    expect(accounting).toHaveBeenLastCalledWith('BankTransactions','',receiptId);
    expect(db.commitPilotMatch.mock.calls[0][0].evidence.amountCents).toBe(4000);
  });
  it.each([{total:41},{reconciled:false},{contactId:receiptId},{updatedAt:'2026-09-03T00:00:00Z'},{id:id}])('does not write when Xero evidence changes %j',async patch=>{
    const proposal=await proposed();accounting.mockResolvedValue([{...receipt,...patch}]);
    await expect(approvePilotDeposit(proposal.approvalToken!,id)).rejects.toThrow('APPROVAL_EVIDENCE_CHANGED');
    expect(db.commitPilotMatch).not.toHaveBeenCalled();
  });
  it('rejects stale portal payment evidence before committing',async()=>{
    const proposal=await proposed();db.loadPilotContext.mockResolvedValue({...context,ledgerFingerprint:'c'.repeat(64)});
    await expect(approvePilotDeposit(proposal.approvalToken!,id)).rejects.toThrow('APPROVAL_EVIDENCE_CHANGED');
    expect(db.commitPilotMatch).not.toHaveBeenCalled();
  });
  it('recovers a committed approval after a lost response without rereading or recording money',async()=>{
    const proposal=await proposed();const approval=readDepositApproval(proposal.approvalToken!,id,id,Buffer.alloc(32,6));
    db.findPilotMatch.mockResolvedValue({id:approval.approvalId,approvedBy:id,tenantId:id,receiptId,invoiceId:id,projectId:id,amountCents:4000,evidenceFingerprint:approval.evidence.receiptFingerprint,paymentEntryId:id,reversedAt:null});
    accounting.mockClear();db.loadPilotContext.mockClear();
    expect(await approvePilotDeposit(proposal.approvalToken!,id)).toEqual({matchId:approval.approvalId,paymentEntryId:id,replayed:true});
    expect(accounting).not.toHaveBeenCalled();expect(db.loadPilotContext).not.toHaveBeenCalled();expect(db.commitPilotMatch).not.toHaveBeenCalled();
  });
  it('blocks receipts already recorded on another project',async()=>{
    db.activeReceiptMatches.mockResolvedValue([{receiptId,invoiceId:receiptId}]);
    const proposal=await proposed();expect(proposal.approvalToken).toBeNull();expect(proposal.blockers).toContain('This receipt is already recorded against another invoice.');
  });
  it('requires investigation for missing identity and manual history',async()=>{
    accounting.mockResolvedValue([{...receipt,contactId:''}]);db.loadPilotContext.mockResolvedValue({...context,hasUnmatchedPaymentHistory:true});
    const proposal=await proposed();expect(proposal.approvalToken).toBeNull();expect(proposal.blockers).toHaveLength(2);
  });
  it('uses remaining deposit after an earlier verified partial receipt',async()=>{
    db.loadPilotContext.mockResolvedValue({...context,matchedCents:6000,customerWon:true});
    expect((await proposed()).depositRemainingIfApprovedCents).toBe(0);
  });
});
