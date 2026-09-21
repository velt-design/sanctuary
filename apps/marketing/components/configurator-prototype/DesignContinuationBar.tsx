'use client';

import Link from 'next/link';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { updateDesignContinuation } from './designContinuation';
import { useDesignContinuation } from './useDesignContinuation';
import styles from './designContinuation.module.css';

export default function DesignContinuationBar() {
  const pathname = usePathname();
  const { started, dismissed } = useDesignContinuation();
  const [pastOpening, setPastOpening] = useState(false);
  const excluded = /^\/products\/pergolas\/(pitched|gable|box-perimeter)\/?$/.test(pathname) || /^\/(design-enquiry|contact|quote|invoice|staff|api|__foundation|qa)(\/|$)/.test(pathname);


  useEffect(() => {
    setPastOpening(false);
    if (excluded || pathname !== '/') return;
    const update = () => setPastOpening(window.scrollY >= Math.min(120, window.innerHeight * .12));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [pathname, excluded]);

  if (excluded || dismissed || (pathname === '/' && !pastOpening)) return null;
  return <aside className={`${styles.bar}${pathname === '/' ? '' : ` ${styles.inFlow}`}`} aria-label="Your pergola design" data-design-placement={pathname === '/' ? 'floating' : 'in-flow'}>
    <Link href={`/configurator-preview?open=1${started ? '&resume=1' : ''}`} className={styles.action}>
      <span>{started ? 'Your pergola' : 'Your pergola, your way.'}</span>
      <span>{started ? 'Continue designing' : 'Start designing'} <span aria-hidden="true"><ArrowUpRight /></span></span>
    </Link>
    <button type="button" aria-label="Dismiss design bar" onClick={() => updateDesignContinuation({ dismissed: true })}>×</button>
  </aside>;
}
