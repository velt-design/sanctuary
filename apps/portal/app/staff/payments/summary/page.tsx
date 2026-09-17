import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { completedWeek } from '@/lib/xero/financeSummaryContract';
import FinanceSummaryClient from './FinanceSummaryClient';

export const dynamic = 'force-dynamic';
export default async function FinanceSummaryPage() {
  if (!await getPaymentPilotSession()) notFound();
  return <PageLayout><PageHeader variant="index" title="Xero finance summary" description="Read invoiced sales, customer invoice receipts and what is still owing." />
    <p><ButtonLink href="/staff/payments" variant="tertiary">Back to Finance</ButtonLink></p>
    <FinanceSummaryClient initialPeriod={completedWeek()} />
  </PageLayout>;
}
