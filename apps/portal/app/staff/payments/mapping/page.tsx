import { notFound } from 'next/navigation';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import MappingReview from './MappingReview';
import { financeMappingContext } from '@/lib/invoices/financeMappingRepository';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
export const dynamic = 'force-dynamic';
export default async function MappingPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  const { invoice } = await searchParams;
  if (typeof invoice !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice)) notFound();
  const contextRead=financeMappingContext(session.user.id,invoice).catch(()=>null);
  return <PageLayout><PageHeader variant="index" title="Confirm Xero details" description="Link the portal customer and verify the sales account and tax against Xero." />
    <p><ButtonLink href="/staff/payments" variant="tertiary">Back to finance review</ButtonLink></p>
    <MappingReview key={invoice} invoiceId={invoice} contextRead={contextRead}/>
  </PageLayout>;
}
