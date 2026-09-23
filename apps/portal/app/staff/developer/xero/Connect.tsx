'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';

export default function Connect({ connected, reports = false }: { connected: boolean; reports?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/integrations/xero/start${reports ? '?mode=reports' : ''}`, { method: 'POST', redirect: 'error' });
      if (!response.ok) throw new Error('START_FAILED');
      const { authorizationUrl } = await response.json();
      const url = new URL(authorizationUrl);
      if (url.origin !== 'https://login.xero.com' || url.pathname !== '/identity/connect/authorize') throw new Error('INVALID_DESTINATION');
      window.location.assign(url.href);
    } catch {
      setError('Could not start the Xero connection. Check developer configuration and retry.');
      setPending(false);
    }
  }
  return <>
    <Button type="button" disabled={pending} onClick={start}>{pending ? 'Opening Xero…' : reports ? 'Allow read-only bank and profit reports' : connected ? 'Reconnect Xero' : 'Connect Xero'}</Button>
    {error && <p role="alert">{error}</p>}
  </>;
}
