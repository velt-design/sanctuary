'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import InvoicesTab from '@/components/projects/ProjectPage/tabs/InvoicesTab';
import { AlertBanner, Button } from '@/components/ui/foundation';

/** Production invoice UI over disposable production SQL; no business access. */
export default function RevisedQuoteFixture() {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  useEffect(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.pathname.startsWith('/api/')) return original(`/api/qa/revised-quote-fixture${url.pathname}`, init);
      return original(input, init);
    };
    void fetch('/api/status').then(r => r.json()).then(r => { setAccepted(r.status === 'ACCEPTED'); setReady(true); });
    return () => { window.fetch = original; };
  }, []);
  async function command(path: string) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/${path}`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAccepted(path === 'accept');
      await client.invalidateQueries();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Command failed'); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 1200, margin: '40px auto', padding: '0 24px' }}>
    <h1>Revised quote and progress billing</h1>
    <p>Synthetic project: $1,600 quoted work, $700 construction deposits and a separate $50 assessment fee. The deposit top-up has been reconciled. No customer emails or Xero calls are possible.</p>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
      <Button onClick={() => void command('accept')} disabled={busy || !ready}>{accepted ? 'Repeat acceptance safely' : 'Accept revised quote'}</Button>
      <Button variant="secondary" onClick={() => void command('reset')} disabled={busy}>Reset synthetic project</Button>
    </div>
    {error ? <AlertBanner tone="blocking" title="Action failed">{error}</AlertBanner> : null}
    {accepted ? <AlertBanner tone="info" title="Quote accepted">Existing payments retained. No invoice was created or sent. Create a custom progress invoice below.</AlertBanner> : null}
    {ready ? <PortalAuthContext.Provider value={{ status: 'authenticated', user: { id: 'synthetic-admin', email: 'admin@example.invalid' }, role: 'admin', email: 'admin@example.invalid', isAdmin: true, signOut: async () => 'cancelled', refresh: async () => {} }}>
      <QueryClientProvider client={client}><InvoicesTab projectId="proj_10000000-0000-4000-8000-000000000001" /></QueryClientProvider>
    </PortalAuthContext.Provider> : <p>Loading synthetic project...</p>}
  </main>;
}
