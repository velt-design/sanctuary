import { notFound, redirect } from 'next/navigation';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { loadInvoicePaymentContext } from '@/lib/invoices/invoicePaymentRepository';
import { config } from '@/lib/xero/security';
import { xeroInvoiceUrl } from '@/lib/xero/invoiceLink';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
export const dynamic='force-dynamic';
export default async function XeroInvoicePage({searchParams}:{searchParams:Promise<{invoice?:string}>}) {
 const session=await getPaymentPilotSession(); if(!session) notFound();
 const {invoice}=await searchParams;
 if(!invoice || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice)) notFound();
 let destination:string | null=null;
 try {
  const context=await loadInvoicePaymentContext(session.user.id,invoice,config().tenantId);
  destination=await xeroInvoiceUrl(context.providerInvoiceId);
 } catch { /* Keep provider errors and credentials out of the page. */ }
 if(destination) redirect(destination);
 return <PageLayout><DataStatePanel state="error" title="Xero invoice could not be opened" description="The saved invoice link or Xero connection could not be verified. Return to Finance and try again. No invoice has been changed." /><ButtonLink href="/staff/payments" variant="secondary">Back to finance review</ButtonLink></PageLayout>;
}
