'use client';

import { useState } from 'react';
import type { PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';
import type { WorkbenchDebugFixtureExport } from '@/lib/drawings/workbenchDebugExport';
import styles from './DesignWorkbenchEstimateClient.module.css';

type WorkbenchDebugExportButtonProps = {
  exportPayload: WorkbenchDebugFixtureExport;
  portalDebugExport?: PortalPageDebugExport | null;
};

export default function WorkbenchDebugExportButton({
  exportPayload,
  portalDebugExport = null,
}: WorkbenchDebugExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const clipboardPayload = portalDebugExport ?? exportPayload;

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(clipboardPayload, null, 2));
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <section className={styles.debugExportPanel} data-workbench-debug-export-panel="true">
      <button
        type="button"
        className={styles.debugExportButton}
        onClick={copyPayload}
        data-workbench-debug-export-copy="true"
      >
        Copy debug fixture payload
      </button>
      <p className={styles.debugExportStatus} data-workbench-debug-export-copy-status={status}>
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Fixture diagnostics enabled'}
      </p>
      {portalDebugExport ? (
        <script
          type="application/json"
          data-portal-debug-export="true"
          data-portal-debug-page-id={portalDebugExport.pageId}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(portalDebugExport).replace(/</g, '\\u003c') }}
        />
      ) : null}
    </section>
  );
}
