'use client';

import { useEffect, useState } from 'react';
import { DataStatePanel } from '@/components/ui/foundation';
import PdfInlinePreview from './QuotePdfInlinePreview';

export default function InvoicePdfInlinePreview({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; data?: Uint8Array; error?: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Could not load invoice PDF (${response.status}).`);
        if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The invoice PDF response was not available.');
        const data = new Uint8Array(await response.arrayBuffer());
        if (!controller.signal.aborted) setResult({ url, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ url, error: error instanceof Error ? error.message : 'Could not load invoice PDF.' });
      }
    })();
    return () => controller.abort();
  }, [attempt, url]);

  const current = result?.url === url ? result : null;
  if (current?.error) return <DataStatePanel state="error" title="Invoice PDF unavailable" description={current.error} onRetry={() => setAttempt((value) => value + 1)} />;
  if (!current?.data) return <p role="status">Loading invoice PDF...</p>;
  return <PdfInlinePreview data={current.data} />;
}
