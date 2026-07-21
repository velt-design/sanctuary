'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './foundation.module.css';

const navigationItems = [
  ['Foundation', '#foundation'],
  ['Patterns', '#patterns'],
  ['Heroes', '#patterns'],
  ['Enquiry', '#foundation-name'],
] as const;

export function FoundationNavigation() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('foundation-menu-open', open);
    document.body.classList.toggle('foundation-menu-open', open);
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.classList.remove('foundation-menu-open');
      document.body.classList.remove('foundation-menu-open');
    };
  }, [open]);

  return (
    <header className={styles.foundationNav} data-foundation-navigation>
      <Link className={styles.foundationBrand} href="#foundation" aria-label="Sanctuary Pergolas marketing foundation">
        <span>Sanctuary</span>
        <small>Pergolas</small>
      </Link>
      <nav className={styles.foundationDesktopLinks} aria-label="Foundation sections">
        {navigationItems.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
      </nav>
      <button
        ref={buttonRef}
        className={styles.foundationMenuButton}
        type="button"
        aria-expanded={open}
        aria-controls="foundation-mobile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{open ? 'Close' : 'Menu'}</span>
        <span aria-hidden="true">{open ? '×' : '☰'}</span>
      </button>
      {open && (
        <nav id="foundation-mobile-menu" className={styles.foundationMobileMenu} aria-label="Foundation mobile sections">
          {navigationItems.map(([label, href], index) => (
            <Link ref={index === 0 ? firstLinkRef : undefined} href={href} key={label} onClick={() => setOpen(false)}>{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
