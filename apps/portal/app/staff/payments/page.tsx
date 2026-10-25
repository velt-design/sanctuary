import { notFound } from 'next/navigation';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import FinanceRegister from '@/components/finance/FinanceRegister';
import XeroFinanceReview from './XeroFinanceReview';

export const dynamic = 'force-dynamic';
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string; view?: string; search?: string; offset?: string }> }) {
  const query = await searchParams;
  // Existing bookmarks continue to open their original Xero review queues.
  if (query.tab === 'xero' || (!query.tab && ['attention','current','history'].includes(query.view ?? ''))) {
    // The existing owner performs its finance gate before returning its shell.
    const review = await XeroFinanceReview({ searchParams: Promise.resolve(query) });
    return <PortalGuardedPage pathname="/staff/payments" completion={{}} publicFrame={false}>{review}</PortalGuardedPage>;
  }
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  return <PortalGuardedPage pathname="/staff/payments" completion={{}} publicFrame={false}><FinanceRegister /></PortalGuardedPage>;
}
