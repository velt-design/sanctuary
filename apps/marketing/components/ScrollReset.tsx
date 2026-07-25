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

    const findHashTarget = () => {
      const rawId = window.location.hash.slice(1);
      if (!rawId) return null;

      try {
        return document.getElementById(decodeURIComponent(rawId));
      } catch {
        return document.getElementById(rawId);
      }
    };

    const scrollToHashTarget = () => {
      const target = findHashTarget();
      if (!target) return false;

      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      return true;
    };

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
        '[data-products-index]',
        '[data-product-detail]',
        '.projects-experience',
      ];
      document
        .querySelectorAll<HTMLElement>(selectors.join(','))
        .forEach((el) => {
          el.scrollTop = 0;
        });
    };

    const settleRouteScroll = () => {
      if (!scrollToHashTarget()) reset();
    };

    let firstFrame = 0;
    let secondFrame = 0;
    const scheduleHashScroll = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        scrollToHashTarget();
        secondFrame = requestAnimationFrame(scrollToHashTarget);
      });
    };

    // Keep the established immediate/next-frame top reset for ordinary route
    // changes. Fragment navigation gets one additional frame so a responsive
    // disclosure can reveal its target before the final scroll.
    settleRouteScroll();
    firstFrame = requestAnimationFrame(() => {
      settleRouteScroll();
      if (window.location.hash) {
        secondFrame = requestAnimationFrame(scrollToHashTarget);
      }
    });
    window.addEventListener('hashchange', scheduleHashScroll);

    return () => {
      window.removeEventListener('hashchange', scheduleHashScroll);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [pathname]);

  return null;
}
