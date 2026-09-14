import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession, paymentPilotEnabled } from '@/lib/xero/pilotAccess';
import { approvePilotDeposit, reviewPilotDeposit } from '@/lib/xero/paymentPilot';
import { findPilotMatch, reversePilotMatch, recordPilotReviewNote } from '@/lib/invoices/xeroMatchRepository';
import { config } from '@/lib/xero/security';

export const runtime='nodejs';
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request) {
  if(!paymentPilotEnabled()) return json({error:'Not found'},404);
  try {
    const session=await getPaymentPilotSession();
    if(!session||!sameOrigin(request)) return json({error:'Payment approval permission is required.'},403);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=='object') return json({error:'Invalid payment request.'},400);
    if(body.action==='review'&&typeof body.invoiceRef==='string'&&/^INV-\d{1,12}$/.test(body.invoiceRef.trim())
      &&(body.contactName===undefined||typeof body.contactName==='string'&&body.contactName.trim().length<=240))
      return json(await reviewPilotDeposit(body.invoiceRef.trim(),body.contactName??'',session.user.id));
    if(body.action==='approve'&&body.confirmed===true&&typeof body.approvalToken==='string'&&body.approvalToken.length<=10000)
      return json(await approvePilotDeposit(body.approvalToken,session.user.id));
    if(body.action==='status'&&typeof body.approvalId==='string'&&uuid.test(body.approvalId)) {
      const match=await findPilotMatch(body.approvalId);
      return json({match:match?.approvedBy===session.user.id?match:null});
    }
    if(body.action==='reverse'&&body.confirmed===true&&typeof body.matchId==='string'&&uuid.test(body.matchId)
      &&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.trim().length<=1000) {
      await reversePilotMatch(body.matchId,body.reason.trim(),session.user.id);
      return json({reversed:true});
    }
    if(body.action==='note'&&typeof body.noteId==='string'&&uuid.test(body.noteId)
      &&typeof body.receiptId==='string'&&uuid.test(body.receiptId)&&typeof body.invoiceId==='string'&&uuid.test(body.invoiceId)
      &&(body.disposition==='REJECTED'||body.disposition==='INVESTIGATE')
      &&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.trim().length<=1000) {
      await recordPilotReviewNote(body.noteId,session.user.id,config().tenantId,body.receiptId,body.invoiceId,body.disposition,body.reason.trim());
      return json({saved:true});
    }
    return json({error:'Check the invoice, confirmation and required reason.'},400);
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    const messages:Record<string,[number,string]>={
      PAYMENT_APPROVAL_FORBIDDEN:[403,'Payment approval permission is required.'],
      INVOICE_NOT_FOUND:[404,'Invoice not found. Check its exact number.'],
      AMBIGUOUS_INVOICE:[409,'Multiple invoices have this number. Resolve the duplicate first.'],
      INVALID_QUERY:[400,'Use the exact Xero customer name (1–240 characters).'],
      APPROVAL_REVIEW_REQUIRED:[409,'This approval expired or is invalid. Check its status before starting a fresh review.'],
      APPROVAL_EVIDENCE_CHANGED:[409,'The evidence changed. Check payment history and review again.'],
      RECEIPT_ALREADY_RECORDED:[409,'This receipt is already recorded. Check the existing match.'],
      MATCH_REVERSED:[409,'This match has been reversed. Start a fresh review.'],
      MATCH_NOT_FOUND:[404,'Match not found.'],
      PAYMENT_RECONCILIATION_REQUIRED:[409,'Existing payments or allocations need investigation before this receipt can be recorded.'],
    };
    const [status,message]=messages[code]??[503,'The payment result could not be confirmed. Check its status before retrying; do not record a manual duplicate.'];
    return json({error:message},status);
  }
}
