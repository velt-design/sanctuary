'use client';

import { useEffect, useState } from 'react';
import PdfInlinePreview from './QuotePdfInlinePreview';

export default function InvoicePdfInlinePreview({ url, enabled = true, readVersion = 0 }: { url: string; enabled?: boolean; readVersion?: number }) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([url, attempt, readVersion]);
  const [result, setResult] = useState<{ key: string; data?: Uint8Array; error?: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult(null);
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Could not load invoice PDF (${response.status}).`);
        if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The invoice PDF response was not available.');
        const data = new Uint8Array(await response.arrayBuffer());
        if (!controller.signal.aborted) setResult({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Could not load invoice PDF.' });
      }
    })();
    return () => controller.abort();
  }, [key, url, enabled]);

  const current = enabled && result?.key === key ? result : null;
  return <PdfInlinePreview data={current?.data ?? null} pending={enabled && !current} readError={!enabled ? "Invoice access unavailable." : current?.error} onRetry={enabled ? () => setAttempt((value) => value + 1) : undefined} />;
}
