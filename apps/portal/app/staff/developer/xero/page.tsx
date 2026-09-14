import { notFound } from 'next/navigation';
import { developer } from '@/lib/xero/http';
import { status } from '@/lib/xero/store';
import Review from './Review';

export const dynamic = 'force-dynamic';
export default async function XeroDeveloperPage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  if (!await developer()) notFound();
  const params = await searchParams;
  let connection: Awaited<ReturnType<typeof status>> | null = null;
  try { connection = await status(); } catch { /* Credentials/schema stay dark until configured. */ }
  const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'}) : 'Not yet';
  return <main style={{maxWidth:900,margin:'32px auto',padding:24}}>
    <h1>Xero developer connection</h1>
    <p>Private connection controls. Xero access is read-only; portal payment records remain unchanged.</p>
    {params.connection === 'failed' && <p role="alert">Authorisation did not complete. Check the configured organisation and retry connection.</p>}
    {params.connection === 'cancelled' && <p role="status">Authorisation cancelled.</p>}
    {!connection ? <p role="status">Setup unavailable. Configure the dedicated database, client credentials, encryption key and organisation binding before connecting.</p> : <>
      <dl><dt>Organisation</dt><dd>{connection.organisation ?? 'Not connected'}</dd>
        <dt>Last verified with Xero</dt><dd>{date(connection.lastVerifiedAt)}</dd>
        <dt>Connection status</dt><dd>{connection.error ?? (connection.connected ? 'Connected' : 'Not connected')}</dd></dl>
      <p>Renewal runs daily and before reads. A stale verification date needs developer investigation.</p>
      <form action="/api/integrations/xero/start" method="post"><button type="submit">{connection.connected ? 'Reconnect Xero' : 'Connect Xero'}</button></form>
      {connection.connected && <Review />}
    </>}
  </main>;
}
