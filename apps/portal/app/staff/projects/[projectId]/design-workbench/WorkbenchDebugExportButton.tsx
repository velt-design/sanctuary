'use client';

import { useState } from 'react';
import type { WorkbenchDebugFixtureExport } from '@/lib/drawings/workbenchDebugExport';
import styles from './DesignWorkbenchEstimateClient.module.css';

type WorkbenchDebugExportButtonProps = {
  exportPayload: WorkbenchDebugFixtureExport;
};

export default function WorkbenchDebugExportButton({ exportPayload }: WorkbenchDebugExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
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
    </section>
  );
}
