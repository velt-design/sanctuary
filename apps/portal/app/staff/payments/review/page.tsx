import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PaymentReview from './PaymentReview';

export const dynamic = 'force-dynamic';
export default async function PaymentReviewPage() {
  if (!await getPaymentPilotSession()) notFound();
  return <PageLayout>
    <PageHeader variant="index" title="Review an older deposit" description="Use this for money received directly in Xero before the automatic invoice workflow. For payments on a linked Xero invoice, open that invoice from Finance instead." />
    <p><ButtonLink variant="secondary" href="/staff/payments">Back to Finance</ButtonLink></p>
    <PaymentReview />
  </PageLayout>;
}
