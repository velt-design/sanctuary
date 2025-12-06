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
    const reset = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }
      // Fallbacks for some browsers
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Reset any route-level scroll containers we use
      const selectors = [
        '.two-col-page',
        '.product-page',
        '.products-index',
        '.projects-experience',
        '.product-left-scroller',
        '.product-right-scroller',
      ];
      document
        .querySelectorAll<HTMLElement>(selectors.join(','))
        .forEach((el) => {
          el.scrollTop = 0;
        });
    };

    // Run immediately and again on the next frame so we catch
    // both the old and newly-mounted route contents.
    reset();
    const raf = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
