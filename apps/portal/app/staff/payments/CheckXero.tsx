'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/foundation/FoundationControls';
export default function CheckXero({ invoiceId, invoiceRef }: { invoiceId: string; invoiceRef: string }) {
  const router = useRouter(); const busy = useRef(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  async function check() {
    if (busy.current) return; busy.current = true; setPending(true); setMessage('');
    try {
      const response = await fetch('/api/payments/xero/observe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Xero could not be checked.');
      setMessage(result.checked ? 'Xero check saved.' : 'Xero was unavailable. Try again.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Xero could not be checked.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <><Button variant="tertiary" size="small" disabled={pending} onClick={() => void check()} aria-label={`Check ${invoiceRef} in Xero`}>{pending ? 'Checking…' : 'Check Xero now'}</Button>{message && <p role="status">{message}</p>}</>;
}
