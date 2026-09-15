'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { updateDesignContinuation } from './designContinuation';
import { useDesignContinuation } from './useDesignContinuation';
import styles from './designContinuation.module.css';

export default function DesignContinuationBar() {
  const pathname = usePathname();
  const { started, dismissed } = useDesignContinuation();
  const [pastOpening, setPastOpening] = useState(false);
  const excluded = /^\/(design-enquiry|contact|quote|invoice|staff|api|__foundation|qa)(\/|$)/.test(pathname);


  useEffect(() => {
    setPastOpening(false);
    if (excluded) return;
    const opening = document.querySelector('[data-homepage-hero], #main-content main header, #main-content main section, #main-content header, #main-content section');
    const update = () => setPastOpening(pathname === '/'
      ? window.scrollY >= Math.min(120, window.innerHeight * .12)
      : opening ? opening.getBoundingClientRect().bottom <= 0 : window.scrollY >= window.innerHeight);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    if (opening) observer.observe(opening);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer.disconnect(); };
  }, [pathname, excluded]);

  if (excluded || dismissed || !pastOpening) return null;
  return <aside className={styles.bar} aria-label="Your pergola design">
    <Link href={`/configurator-preview?open=1${started ? '&resume=1' : ''}`} className={styles.action}>
      <span>{started ? 'Your pergola' : 'Your pergola, your way.'}</span>
      <span>{started ? 'Continue designing' : 'Start designing'} <span aria-hidden="true">↗</span></span>
    </Link>
    <button type="button" aria-label="Dismiss design bar" onClick={() => updateDesignContinuation({ dismissed: true })}>×</button>
  </aside>;
}
