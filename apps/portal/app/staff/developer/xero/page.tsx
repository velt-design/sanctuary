import { notFound } from 'next/navigation';
import { developer } from '@/lib/xero/http';
import { status } from '@/lib/xero/store';
import { discoveredOrganisations } from '@/lib/xero/discovery';
import { setupError } from '@/lib/xero/setupError';
import Review from './Review';
import Connect from './Connect';
import PaymentSuggestions from './PaymentSuggestions';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import PageHeader from '@/components/layout/PageHeader';
import { Badge, Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';

export const dynamic = 'force-dynamic';
export default async function XeroDeveloperPage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const session=await developer();
  if (!session) notFound();
  const organisations=await discoveredOrganisations(session.user.id);
  const params = await searchParams;
  let connection: Awaited<ReturnType<typeof status>> | null = null;
  let setupFailure = '';
  try { connection = await status(); } catch (error) { setupFailure = setupError(error); }
  let paymentPilot = false;
  try { paymentPilot = Boolean(await getPaymentPilotSession()); } catch { /* Connection diagnostics must remain usable if the pilot store is unavailable. */ }
  const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'}) : 'Not yet';
  return <PageLayout>
    <PageHeader title="Xero connection" description="Private developer controls. Day-to-day invoice and payment work happens in Finance." />
    {organisations.length>0 && <section aria-label="Discovered Xero organisations">
      <h2>Verify the organisation binding</h2>
      <p>These organisations were returned by Xero after authorisation. No connection tokens were retained and no accounting records were read. Configure the approved organisation ID, then connect again.</p>
      <ul>{organisations.map(item=><li key={item.tenantId}>{item.tenantName}: <code>{item.tenantId}</code></li>)}</ul>
    </section>}
    {params.connection === 'failed' && <p role="alert">Authorisation did not complete. Check the configured organisation and retry connection.</p>}
    {params.connection === 'cancelled' && <p role="status">Authorisation cancelled.</p>}
    {!connection ? <p role="status">Setup unavailable. {setupFailure}</p> : <>
      <Card title={connection.organisation ?? 'No Xero organisation connected'}>
      <Badge tone={connection.error ? 'warning' : connection.connected ? 'success' : 'neutral'}>{connection.error ? 'Connection needs attention' : connection.connected ? 'Connected' : 'Not connected'}</Badge>
      <p>{connection.error ? 'The connection reported a problem. Review the details below before relying on fresh Xero information.' : connection.connected ? 'The portal can connect to this Xero organisation. You do not need to reconnect for each invoice.' : 'Connect the approved Xero organisation to allow the portal to exchange invoice information.'}</p>
      <p>Last verified with Xero: {date(connection.lastVerifiedAt)}</p>
      {connection.error && <p>Reported problem: {connection.error}</p>}
      <p>Last verification confirms connection access; it does not mean every invoice or payment is up to date. Finance shows those checks separately.</p>
      {paymentPilot && <ButtonLink href="/staff/payments" variant="primary">Go to Finance</ButtonLink>}
      </Card>
      {!connection.connected && <Connect connected={false} />}
      <details><summary>Developer connection checks</summary>
        {process.env.XERO_INVOICE_CONSENT_ENABLED === 'true' && <p>Connecting requests Xero permission to manage invoices and contacts, and to read accounting settings. The portal uses this access for draft invoices and explicitly confirmed customer creation. Automatic transfers require separate activation; finance reviews drafts before posting.</p>}
        <p>Renewal runs daily and before reads. A stale verification date needs developer investigation. Connecting does not record portal payments or post Xero invoices.</p>
        {connection.connected && <Connect connected />}
        {connection.connected && <><PaymentSuggestions /><Review /></>}
      </details>
    </>}
  </PageLayout>;
}
