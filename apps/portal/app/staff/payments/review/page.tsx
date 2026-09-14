import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PaymentReview from './PaymentReview';

export const dynamic = 'force-dynamic';
export default async function PaymentReviewPage() {
  if (!await getPaymentPilotSession()) notFound();
  return <PageLayout>
    <PageHeader variant="index" title="Deposit review" description="Confirm which project received a customer deposit. Jordan is the pilot approver." />
    <PaymentReview />
  </PageLayout>;
}
