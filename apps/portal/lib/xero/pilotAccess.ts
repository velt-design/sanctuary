import 'server-only';
import { getPortalSession } from '../auth';
import { hasPaymentApprovalGrant } from '../invoices/xeroMatchRepository';
import { isPaymentApprover } from './paymentApproval';

export function paymentPilotEnabled() { return process.env.XERO_PAYMENT_MATCHING_ENABLED==='true'; }
export async function getPaymentPilotSession() {
  if(!paymentPilotEnabled()) return null;
  const session=await getPortalSession();
  if(!session || !isPaymentApprover(session.user) || !await hasPaymentApprovalGrant(session.user.id)) return null;
  return session;
}
