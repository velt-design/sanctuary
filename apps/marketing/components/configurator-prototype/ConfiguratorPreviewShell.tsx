'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfiguratorPrototype from './ConfiguratorPrototype';
import { usePreviewExpansion } from './usePreviewExpansion';
import styles from './previewShell.module.css';
import foundation from '../marketing-foundation/foundation.module.css';

export default function ConfiguratorPreviewShell() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  const [launcherHost, setLauncherHost] = useState<HTMLElement | null>(null);
  const { expanded, toggleExpanded, collapse } = usePreviewExpansion();
  useEffect(() => { setLauncherHost(document.body); }, []);

  // One scroll-lock owner for both normal and expanded inspection.
  useEffect(() => {
    if (!opened) return;
    const roots = [document.documentElement, document.body];
    const previous = roots.map(root => ({ overflow: root.style.overflow, overscrollBehavior: root.style.overscrollBehavior }));
    roots.forEach(root => { root.style.overflow = 'hidden'; root.style.overscrollBehavior = 'none'; });
    return () => roots.forEach((root, index) => {
      root.style.overflow = previous[index].overflow;
      root.style.overscrollBehavior = previous[index].overscrollBehavior;
    });
  }, [opened]);

  const open = () => { setVisited(true); dialog.current?.showModal(); setOpened(true); };
  return <div className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>YOUR PERGOLA / DESIGN PREVIEW</p>
      <h1>Your space.<br />Your pergola.</h1>
      <p>Shape a little more room for everyday life.<br />Explore the possibilities for your home.</p>
      <button type="button" className={styles.start} onClick={open}>Explore your design <span aria-hidden="true">↗</span></button>
    </header>
    <section className={styles.context} aria-label="Design possibilities">
      <p>A little shelter.<br />A whole new way to live outside.</p>
      <span>Find your proportions. Choose your roof. See it take shape.</span>
    </section>
    {launcherHost && createPortal(<div className={`${foundation.marketingPage} ${styles.launcherHost}`}><button type="button" className={styles.launcher} onClick={open} aria-haspopup="dialog" aria-expanded={opened}>
      <span>{visited ? 'Your pergola' : 'Design your pergola'}</span><span>{visited ? 'Continue designing' : 'Explore in 3D'} <span aria-hidden="true">↗</span></span>
    </button></div>, launcherHost)}
    <dialog ref={dialog} className={styles.panel} aria-label="Design your pergola" data-expanded={expanded}
      onCancel={event => { if (expanded) { event.preventDefault(); collapse(); } }}
      onClose={() => { setOpened(false); collapse(); }}>
      <div className={styles.panelHeader}><span>Your pergola.</span><button type="button" onClick={() => dialog.current?.close()} aria-label="Close configurator">Close <span aria-hidden="true">×</span></button></div>
      {visited && <ConfiguratorPrototype expanded={expanded} onToggleExpanded={toggleExpanded} />}
    </dialog>
  </div>;
}
