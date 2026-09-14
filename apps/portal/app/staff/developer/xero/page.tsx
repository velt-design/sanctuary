import { notFound } from 'next/navigation';
import { developer } from '@/lib/xero/http';
import { status } from '@/lib/xero/store';
import { discoveredOrganisations } from '@/lib/xero/discovery';
import { setupError } from '@/lib/xero/setupError';
import Review from './Review';

export const dynamic = 'force-dynamic';
export default async function XeroDeveloperPage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const session=await developer();
  if (!session) notFound();
  const organisations=await discoveredOrganisations(session.user.id);
  const params = await searchParams;
  let connection: Awaited<ReturnType<typeof status>> | null = null;
  let setupFailure = '';
  try { connection = await status(); } catch (error) { setupFailure = setupError(error); }
  const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'}) : 'Not yet';
  return <main style={{maxWidth:900,margin:'32px auto',padding:24}}>
    <h1>Xero developer connection</h1>
    <p>Private connection controls. Xero access is read-only; portal payment records remain unchanged.</p>
    {organisations.length>0 && <section aria-label="Discovered Xero organisations">
      <h2>Verify the organisation binding</h2>
      <p>These organisations were returned by Xero after authorisation. No connection tokens were retained and no accounting records were read. Configure the approved organisation ID, then connect again.</p>
      <ul>{organisations.map(item=><li key={item.tenantId}>{item.tenantName}: <code>{item.tenantId}</code></li>)}</ul>
    </section>}
    {params.connection === 'failed' && <p role="alert">Authorisation did not complete. Check the configured organisation and retry connection.</p>}
    {params.connection === 'cancelled' && <p role="status">Authorisation cancelled.</p>}
    {!connection ? <p role="status">Setup unavailable. {setupFailure}</p> : <>
      <dl><dt>Organisation</dt><dd>{connection.organisation ?? 'Not connected'}</dd>
        <dt>Last verified with Xero</dt><dd>{date(connection.lastVerifiedAt)}</dd>
        <dt>Connection status</dt><dd>{connection.error ?? (connection.connected ? 'Connected' : 'Not connected')}</dd></dl>
      <p>Renewal runs daily and before reads. A stale verification date needs developer investigation.</p>
      <form action="/api/integrations/xero/start" method="post"><button type="submit">{connection.connected ? 'Reconnect Xero' : 'Connect Xero'}</button></form>
      {connection.connected && <Review />}
    </>}
  </main>;
}
