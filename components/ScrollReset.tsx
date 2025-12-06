'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Resets scroll position when the top-level route changes.
 * This helps when content pages use their own scroll container
 * (e.g. `.two-col-page`) which Next.js does not reset automatically.
 */
export default function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Run after layout so measurements are stable
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }

      const main = document.querySelector<HTMLElement>('.two-col-page');
      if (main) {
        main.scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}

