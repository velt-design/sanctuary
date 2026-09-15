import { notFound } from 'next/navigation';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import MappingReview from './MappingReview';
import { financeMappingContext } from '@/lib/invoices/financeMappingRepository';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
export const dynamic = 'force-dynamic';
export default async function MappingPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const session = await getPaymentPilotSession();
  if (!session) notFound();
  const { invoice } = await searchParams;
  if (typeof invoice !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice)) notFound();
  let context: Awaited<ReturnType<typeof financeMappingContext>> | null = null;
  try { context = await financeMappingContext(session.user.id, invoice); } catch { /* Do not render commands without a verified invoice. */ }
  return <PageLayout><PageHeader variant="index" title="Confirm Xero details" description="Link the portal customer and verify the sales account and tax against Xero." />
    <p><ButtonLink href="/staff/payments" variant="tertiary">Back to finance review</ButtonLink></p>
    {context ? <MappingReview key={invoice} invoiceId={invoice} initialContext={context} /> : <>
      <DataStatePanel state="error" title="Invoice details could not be loaded" description="Return to the project and check that this invoice has a linked customer and is open or paid in NZD. No Xero details have been changed." />
      <ButtonLink href={`/staff/payments/mapping?invoice=${invoice}`} variant="secondary">Try again</ButtonLink>
    </>}
  </PageLayout>;
}
