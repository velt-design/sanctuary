import { useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from '@/components/ui/drawer/Drawer';
import styles from './Financials.module.css';

/** Keep report coordinates stable while loading, retaining evidence or recovering. */
export default function FinancialStatus({ summary, message, retry, busy }: { summary: string; message?: string; retry?: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <div className={styles.status}>
      <p role="status" aria-live="polite">{summary}</p>
      <div className={styles.statusActions}>
        {message && <Button variant="quiet" onClick={() => setOpen(true)}>Details</Button>}
        {retry && <Button variant="secondary" onClick={retry} disabled={busy}>Retry</Button>}
      </div>
    </div>
    <Drawer title="Report status" open={open} onClose={() => setOpen(false)}>
      <div className={styles.detail}><p>{summary}</p><p>{message}</p></div>
    </Drawer>
  </>;
}
