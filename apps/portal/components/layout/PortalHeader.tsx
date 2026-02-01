'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './PortalHeader.module.css';
import HeaderHistoryNav from './HeaderHistoryNav';
import SaveStatusPill from './SaveStatusPill';
import Switch from '@/components/ui/Switch';
import { useCalculatorUiPrefs } from '@/lib/ui/useCalculatorUiPrefs';

export default function PortalHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { previewLayoutEnabled, setPreviewLayoutEnabled } = useCalculatorUiPrefs();

  useEffect(() => setMounted(true), []);
  const showPreviewToggle =
    mounted &&
    typeof pathname === 'string' &&
    (pathname.startsWith('/staff/calculator') || pathname.startsWith('/calculator'));

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.right}>
          <HeaderHistoryNav />
          <SaveStatusPill />
          {showPreviewToggle ? (
            <div className={styles.previewToggle}>
              <span className={styles.previewLabel}>Preview</span>
              <Switch
                checked={previewLayoutEnabled}
                onChange={setPreviewLayoutEnabled}
                ariaLabel="Toggle calculator preview layout"
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
