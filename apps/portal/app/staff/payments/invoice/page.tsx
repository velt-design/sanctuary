import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import InvoicePayments from './InvoicePayments';
export const dynamic = 'force-dynamic';
export default async function InvoicePaymentPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  if (process.env.XERO_INVOICE_PAYMENTS_ENABLED !== 'true' || !await getPaymentPilotSession()) notFound();
  const { invoice } = await searchParams;
  if (!invoice || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice)) notFound();
  return <PageLayout><PageHeader variant="index" title="Review invoice payments" description="Check Xero receipts, approve a portal payment record and review previous matches." />
    <p><ButtonLink href="/staff/payments" variant="tertiary">Back to finance review</ButtonLink></p><InvoicePayments invoiceId={invoice} /></PageLayout>;
}
