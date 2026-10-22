import 'server-only';
import { getPortalSession, getFreshPortalSession } from '../auth';
import { hasPaymentApprovalGrant } from '../invoices/xeroMatchRepository';
import { isPaymentApprover } from './paymentApproval';

export function paymentPilotEnabled() { return process.env.XERO_PAYMENT_MATCHING_ENABLED==='true'; }
export async function getPaymentPilotSession(readSession = getPortalSession) {
  if(!paymentPilotEnabled()) return null;
  const session=await readSession();
  if(!session?.user.email_confirmed_at || !isPaymentApprover(session.user, await hasPaymentApprovalGrant(session.user.id))) return null;
  return session;
}

export const getFreshPaymentPilotSession = () => getPaymentPilotSession(getFreshPortalSession);
