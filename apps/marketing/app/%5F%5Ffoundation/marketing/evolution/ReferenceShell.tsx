'use client';

import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container, MarketingPage } from '@/components/marketing-foundation';
import { PRODUCT_REFERENCE, PROJECT_REFERENCE, REFERENCE_ROOT } from './referencePaths';
import motion from './evolution.module.css';
import styles from './reference.module.css';

export default function ReferenceShell({ children, page, enquiryHref }: { children: ReactNode; page: 'project' | 'product'; enquiryHref: string }) {
  const params = useSearchParams();
  const layout = params.get('composition') === 'split' ? 'split' : 'editorial';
  const expressive = params.get('motion') === 'expressive';
  const still = params.get('still') === 'true';
  const [menuOpen, setMenuOpen] = useState(false);
  const changeSetting = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(null, '', url);
  };
  const roof = params.get('roof');
  const query = new URLSearchParams({ composition: layout, motion: expressive ? 'expressive' : 'quiet', ...(still ? { still: 'true' } : {}), ...(roof && ['acrylic', 'solid', 'combination'].includes(roof) ? { roof } : {}) }).toString();
  const links = [{ href: `${PROJECT_REFERENCE}?${query}`, label: 'The project', page: 'project' }, { href: `${PRODUCT_REFERENCE}?${query}`, label: 'Gable pergolas', page: 'product' }];

  return <MarketingPage className={`${motion.page} ${styles.page}`} data-reference={page} data-composition={layout} data-motion={expressive ? 'expressive' : 'quiet'} data-still={still}>
    <Link className={styles.skip} href="#reference-content">Skip to page content</Link>
    <div className={styles.reviewBar}><Container width="wide" className={styles.reviewInner}><Link href={REFERENCE_ROOT}>← Foundation studies</Link><span>Local design preview</span><details className={styles.reviewSettings}><summary>Review settings</summary><div className={styles.settingsBody}>
      <p>Compare the same content and imagery.</p>
      <fieldset><legend>Project composition</legend>{[['editorial', 'Editorial'], ['split', 'Split']].map(([value, label]) => <label key={value}><input type="radio" name="composition" checked={layout === value} onChange={() => changeSetting('composition', value)} />{label}</label>)}</fieldset>
      <fieldset><legend>Motion</legend>{[['quiet', 'Quiet'], ['expressive', 'Expressive']].map(([value, label]) => <label key={value}><input type="radio" name="reference-motion" checked={(expressive ? 'expressive' : 'quiet') === value} onChange={() => changeSetting('motion', value)} />{label}</label>)}</fieldset>
      <label><input type="checkbox" checked={still} onChange={event => changeSetting('still', String(event.target.checked))} />Reduce motion</label>
      <p>Device motion preferences always take priority. Settings stay in the URL. Project composition changes the project page only.</p>
    </div></details></Container></div>
    <header className={styles.header}><Container width="wide" className={styles.headerInner}>
      <Link href={`${PROJECT_REFERENCE}?${query}`} className={styles.brand} aria-label="Sanctuary project reference">Sanctuary<span>Pergolas</span></Link>
      <nav aria-label="Reference pages" className={styles.desktopNav}>{links.map(link => <Link key={link.page} href={link.href} aria-current={page === link.page ? 'page' : undefined}>{link.label}</Link>)}</nav>
      <Link className={styles.headerAction} href={enquiryHref}>Start your project <span aria-hidden="true">↗</span></Link>
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}><Dialog.Trigger className={styles.menuButton}>Menu <span aria-hidden="true">＋</span></Dialog.Trigger><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.menu}>
        <div className={styles.menuTop}><span className={styles.brand}>Sanctuary<span>Pergolas</span></span><Dialog.Close className={styles.menuButton}>Close ×</Dialog.Close></div>
        <Dialog.Title className={styles.menuTitle}>Find your next step.</Dialog.Title><Dialog.Description>Explore the work and the form behind it.</Dialog.Description>
        <nav aria-label="Menu">{links.map(link => <Link key={link.page} href={link.href} aria-current={page === link.page ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}<span aria-hidden="true">↗</span></Link>)}<Link href={enquiryHref} onClick={() => setMenuOpen(false)}>Start your project<span aria-hidden="true">↗</span></Link></nav>
        <p className={styles.menuBottom}>Architectural pergolas.<br />Designed and built in Auckland.</p>
      </Dialog.Content></Dialog.Root>
    </Container></header>
    <div id="reference-content">{children}</div>
    <div className={styles.footer}><Container width="wide" className={styles.footerInner}><span className={styles.brand}>Sanctuary<span>Pergolas</span></span><p>Architectural pergola design & build<br />Auckland and selected surrounding projects</p><Link href={REFERENCE_ROOT}>Back to foundation studies ↑</Link></Container></div>
  </MarketingPage>;
}
