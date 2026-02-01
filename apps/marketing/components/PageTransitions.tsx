'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const OUT_DURATION = 600; // ms – keep in sync with CSS
const NAV_DELAY = 0; // ms delay before navigating

export default function PageTransitions(){
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Respect reduced motion: do not intercept navigation for animations
    if (typeof window !== 'undefined') {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return;
        }
      } catch {}
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (a.target && a.target !== '_self') return;
      // Only same-origin internal links
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Intercept only when path actually changes
        const nextPath = url.pathname + url.search + url.hash;
        if (nextPath === window.location.pathname + window.location.search + window.location.hash) return;
        // set classes for the right exit animation
        document.body.classList.remove('page-in', 'page-in-products', 'page-out', 'page-out-products');
        document.body.classList.add('page-out');
        if (NAV_DELAY > 0) {
          e.preventDefault();
          window.setTimeout(() => {
            router.push(nextPath);
          }, NAV_DELAY);
        }
      } catch { /* ignore */ }
    };
    document.addEventListener('click', onClick, true); // capture to beat Next.js Link
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);

  useEffect(() => {
    // Respect reduced motion: skip page-in animation classes
    if (typeof window !== 'undefined') {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return;
        }
      } catch {}
    }
    // New route mounted – animate in (choose variant)
    document.body.classList.remove('page-out', 'page-out-products', 'page-in', 'page-in-products');
    document.body.classList.add('page-in');
    const to = window.setTimeout(() => document.body.classList.remove('page-in'), OUT_DURATION + 120);
    return () => window.clearTimeout(to);
  }, [pathname]);

  return null;
}
