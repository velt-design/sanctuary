'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import InvoicesTab from '@/components/projects/ProjectPage/tabs/InvoicesTab';

/** Local-only real SQL harness. API calls cannot reach a business environment. */
export default function InvoiceRestoreFixture() {
  const [ready, setReady] = useState(false);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  useEffect(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        window.location.href,
      );
      if (url.pathname.startsWith('/api/')) return original(`/api/qa/invoice-restore-fixture${url.pathname}`, init);
      return original(input, init);
    };
    setReady(true);
    return () => {
      window.fetch = original;
    };
  }, []);
  return (
    <main style={{ maxWidth: 1200, margin: '40px auto', padding: '0 24px' }}>
      <h1>Invoice restoration</h1>
      <p>
        Synthetic local project. Changes run against disposable PostgreSQL in this preview process; no customer emails
        or Xero writes.
      </p>
      <button
        onClick={async () => {
          await fetch('/api/reset', { method: 'POST' });
          await client.invalidateQueries();
        }}
      >
        Reset sample
      </button>
      {ready ? (
        <PortalAuthContext.Provider
          value={{
            status: 'authenticated',
            user: { id: 'synthetic-admin', email: 'admin@example.invalid' },
            role: 'admin',
            email: 'admin@example.invalid',
            isAdmin: true,
            signOut: async () => 'cancelled',
            refresh: async () => {},
          }}
        >
          <QueryClientProvider client={client}>
            <InvoicesTab projectId="proj_10000000-0000-4000-8000-000000000001" />
          </QueryClientProvider>
        </PortalAuthContext.Provider>
      ) : (
        <p>Loading sample...</p>
      )}
    </main>
  );
}
