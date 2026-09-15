'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function RecoverTransfer({ invoiceId }: { invoiceId: string }) {
  const router = useRouter(); const busy = useRef(false);
  const [confirmed, setConfirmed] = useState(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function recover() {
    if (busy.current || !confirmed) return;
    busy.current = true; setPending(true); setMessage('Checking the saved transfer against Xero…');
    try {
      const response = await fetch('/api/payments/xero/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, confirmed: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Recovery could not be checked. Nothing was resent.');
      setMessage(data.state === 'already_verified' ? 'This transfer was already verified. Refreshing finance review.' : 'The existing Xero draft was verified and linked. Nothing was resent.');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery could not be checked. Retry to check the same transfer.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <div><label><input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} /> Check and link the existing Xero draft if it matches this invoice.</label>{' '}
    <button disabled={pending || !confirmed} onClick={() => void recover()}>Recover stopped transfer</button>
    {message && <p role="status">{message}</p>}</div>;
}
