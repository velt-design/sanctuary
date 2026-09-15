'use client';
import { useEffect, useRef, useState } from 'react';
import ConfiguratorPrototype from './ConfiguratorPrototype';
import { usePreviewExpansion } from './usePreviewExpansion';
import styles from './previewShell.module.css';
import foundation from '../marketing-foundation/foundation.module.css';

export default function ConfiguratorDialog({ open, onClose, resume = false }: { open: boolean; onClose: () => void; resume?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [visited, setVisited] = useState(open);
  const { expanded, toggleExpanded, collapse } = usePreviewExpansion();
  useEffect(() => {
    if (open) { setVisited(true); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const roots = [document.documentElement, document.body];
    const previous = roots.map(root => ({ overflow: root.style.overflow, overscrollBehavior: root.style.overscrollBehavior }));
    roots.forEach(root => { root.style.overflow = 'hidden'; root.style.overscrollBehavior = 'none'; });
    return () => roots.forEach((root, index) => {
      root.style.overflow = previous[index].overflow;
      root.style.overscrollBehavior = previous[index].overscrollBehavior;
    });
  }, [open]);
  return <dialog ref={dialog} style={{ minHeight: 0 }} className={`${foundation.marketingPage} ${styles.panel}`} aria-label="Design your pergola" data-expanded={expanded}
    onCancel={event => { if (expanded) { event.preventDefault(); collapse(); } }}
    onClose={() => { collapse(); onClose(); }}>
    <div className={styles.panelHeader}><span>Your pergola.</span><button type="button" onClick={() => dialog.current?.close()} aria-label="Close configurator">Close <span aria-hidden="true">×</span></button></div>
    {visited && <ConfiguratorPrototype expanded={expanded} onToggleExpanded={toggleExpanded} resume={resume} />}
  </dialog>;
}
