'use client';

import { useState } from 'react';
import { Bug, Copy } from 'lucide-react';

import { Badge, Button } from '@/components/ui/foundation';
import type { PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';
import styles from './PortalDebugExportButton.module.css';

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
    <aside className={styles.panel} data-portal-debug-export-panel="true" aria-label="Debug export">
      <Bug aria-hidden="true" />
      <Button
        type="button"
        variant="tertiary"
        size="small"
        leadingIcon={<Copy aria-hidden="true" />}
        onClick={copyPayload}
        data-portal-debug-export-copy="true"
      >
        {label}
      </Button>
      <Badge tone={status === 'failed' ? 'error' : status === 'copied' ? 'success' : 'neutral'} data-portal-debug-export-copy-status={status}>
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Debug export enabled'}
      </Badge>
      <script
        type="application/json"
        data-portal-debug-export="true"
        data-portal-debug-page-id={payload.pageId}
        dangerouslySetInnerHTML={{ __html: serializedPayload }}
      />
    </aside>
  );
}
