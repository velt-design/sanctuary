'use client';

import { useState } from 'react';

import type { PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';

type PortalDebugExportButtonProps = {
  payload: PortalPageDebugExport;
  label?: string;
};

export default function PortalDebugExportButton({
  payload,
  label = 'Copy page debug payload',
}: PortalDebugExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const serializedPayload = JSON.stringify(payload).replace(/</g, '\\u003c');

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <section data-portal-debug-export-panel="true" style={{ margin: '8px 0' }}>
      <button type="button" onClick={copyPayload} data-portal-debug-export-copy="true">
        {label}
      </button>
      <span data-portal-debug-export-copy-status={status} style={{ marginLeft: 8, fontSize: 12 }}>
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Debug export enabled'}
      </span>
      <script
        type="application/json"
        data-portal-debug-export="true"
        data-portal-debug-page-id={payload.pageId}
        dangerouslySetInnerHTML={{ __html: serializedPayload }}
      />
    </section>
  );
}
