'use client';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { consumeConfiguratorReturn, prepareConfiguratorReturn, safeConfiguratorReturn } from './configuratorReturn';
import Link from 'next/link';
import ConfiguratorDialog from './ConfiguratorDialog';
import styles from './previewShell.module.css';

export default function ConfiguratorPreviewShell({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [opened, setOpened] = useState(initiallyOpen);
  const router = useRouter();
  const returnEntry = useRef<ReturnType<typeof consumeConfiguratorReturn>>(null);
  useEffect(() => { returnEntry.current ??= consumeConfiguratorReturn(); }, []);
  useEffect(() => { if (initiallyOpen) setOpened(true); }, [initiallyOpen]);
  const open = () => setOpened(true);
  const close = () => {
    setOpened(false);
    if (returnEntry.current) {
      prepareConfiguratorReturn(returnEntry.current);
      returnEntry.current = null;
      router.back();
      return;
    }
    const source = safeConfiguratorReturn(new URLSearchParams(window.location.search).get('source_path'), window.location.origin);
    if (source) router.replace(source);
  };
  return <div className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>YOUR PERGOLA / DESIGN PREVIEW</p>
      <h1>Your space.<br />Your pergola.</h1>
      <p>Shape a little more room for everyday life.<br />Explore the possibilities for your home.</p>
      <button type="button" className={styles.start} onClick={open}>Explore your design <span aria-hidden="true"><ArrowUpRight /></span></button>
    </header>
    <section className={styles.context} aria-label="Design possibilities">
      <p>A little shelter.<br />A whole new way to live outside.</p>
      <span>Find your proportions. Choose your roof. See it take shape.</span>
      <Link className={styles.projectLink} href="/contact?configurator=preview" prefetch={false}>Start your project <ArrowUpRight /></Link>
    </section>
    <ConfiguratorDialog open={opened} onClose={close} />
  </div>;
}
