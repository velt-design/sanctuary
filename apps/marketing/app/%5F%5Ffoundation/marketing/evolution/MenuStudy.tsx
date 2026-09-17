'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import styles from './evolution.module.css';

const destinations = [['project-study', '01', 'Explore the work'], ['material-study', '02', 'Choose a material'], ['navigation-study', '03', 'Navigate with clarity']] as const;

export default function MenuStudy() {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  // Keep the dialog in the study tree so both motion treatments and reduced
  // motion inherit from the same scoped owner. Radix owns focus and dismissal.
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger className={styles.menuTrigger}>Menu <span aria-hidden="true">＋</span></Dialog.Trigger>
    <Dialog.Overlay className={styles.menuOverlay} />
    <Dialog.Content className={styles.menuPanel} onCloseAutoFocus={event => {
      if (!destination) return;
      event.preventDefault();
      const target = document.getElementById(destination);
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView();
      setDestination(null);
    }}>
      <div className={styles.menuTop}><span className={styles.brand}>Sanctuary<span>Pergolas</span></span><Dialog.Close className={styles.control}>Close <span aria-hidden="true">×</span></Dialog.Close></div>
      <Dialog.Title className={styles.menuTitle}>Take a closer look.</Dialog.Title>
      <Dialog.Description className={styles.menuDescription}>Explore the foundation studies.</Dialog.Description>
      <nav aria-label="Study navigation">{destinations.map(([id, number, title]) => <a key={id} href={`#${id}`} onClick={() => { setDestination(id); setOpen(false); }}><span>{number}</span>{title}<span aria-hidden="true">↗</span></a>)}</nav>
      <p className={styles.menuFoot}>Internal design preview<br />Sanctuary Marketing</p>
    </Dialog.Content>
  </Dialog.Root>;
}
