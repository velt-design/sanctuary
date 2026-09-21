'use client';
import { useEffect, useRef, useState } from 'react';
import ConfiguratorPrototype from './ConfiguratorPrototype';
import { usePreviewExpansion } from './usePreviewExpansion';
import styles from './previewShell.module.css';
import foundation from '../marketing-foundation/foundation.module.css';
import { updateDesignContinuation } from './designContinuation';
import { lockPageScroll } from '../marketing-foundation/pageScrollLock';

export default function ConfiguratorDialog({ open, onClose, resume = false }: { open: boolean; onClose: () => void; resume?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const releaseScroll = useRef<(() => void) | undefined>(undefined);
  const [visited, setVisited] = useState(open);
  const { expanded, toggleExpanded, collapse } = usePreviewExpansion();
  useEffect(() => {
    if (open) {
      // A new design visit restores the continuation bar after the dialog closes.
      updateDesignContinuation({ dismissed: false });
      const release = lockPageScroll();
      releaseScroll.current = release;
      setVisited(true); dialog.current?.showModal();
      return release;
    }
    else dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} style={{ minHeight: 0 }} className={`${foundation.marketingPage} ${styles.panel}`} aria-label="Design your pergola" data-expanded={expanded}
    onCancel={event => { if (expanded) { event.preventDefault(); collapse(); } }}
    onClose={() => { releaseScroll.current?.(); collapse(); onClose(); }}>
    <div className={styles.panelHeader}><span>Your pergola.</span><button type="button" onClick={() => dialog.current?.close()} aria-label="Close configurator">Close <span aria-hidden="true">×</span></button></div>
    {visited && <ConfiguratorPrototype active={open} expanded={expanded} onToggleExpanded={toggleExpanded} resume={resume} />}
  </dialog>;
}
