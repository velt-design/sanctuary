import { notFound } from 'next/navigation';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import MappingReview from './MappingReview';
export const dynamic = 'force-dynamic';
export default async function MappingPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  if (!await getPaymentPilotSession()) notFound();
  const { invoice } = await searchParams;
  if (typeof invoice !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice)) notFound();
  return <PageLayout><PageHeader variant="index" title="Confirm Xero details" description="Link the portal customer and verify the sales account and tax against Xero." />
    <p><a href="/staff/payments">Back to finance review</a></p><MappingReview invoiceId={invoice} /></PageLayout>;
}
