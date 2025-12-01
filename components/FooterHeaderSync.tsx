'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Sync header styling with footer position so that:
// - While the footer is beneath the header but not at the top: header is transparent and text/line are hidden
// - When the footer reaches the top of the viewport: header text + line turn light (white-ish)
export default function FooterHeaderSync(){
  const pathname = usePathname();
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header.site');
    const footer = document.querySelector<HTMLElement>('footer');
    if (!header || !footer) return;

    // Create/ensure a tiny sentinel at the very top of the footer
    let sent = footer.querySelector<HTMLElement>('[data-footer-sentinel]');
    if (!sent){
      sent = document.createElement('div');
      sent.setAttribute('data-footer-sentinel', '');
      sent.style.position = 'absolute';
      sent.style.left = '0';
      sent.style.top = '0';
      sent.style.width = '1px';
      sent.style.height = '1px';
      sent.style.pointerEvents = 'none';
      footer.style.position = footer.style.position || 'relative';
      footer.prepend(sent);
    }

    const EPS = 24; // px tolerance

    const apply = () => {
      const h = header.getBoundingClientRect().height || 0;
      const top = sent!.getBoundingClientRect().top;
      const atTop = top <= EPS;
      const overlap = !atTop && top <= (h + EPS);
      document.body.classList.toggle('footer-at-top', atTop);
      document.body.classList.toggle('footer-overlap', overlap);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; apply(); });
    };

    // Initial + observers
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Recompute when the route changes so header colours update immediately
  useEffect(() => {
    // wait for new route layout to commit
    const recalc = () => {
      const sent = document.querySelector<HTMLElement>('footer [data-footer-sentinel]');
      if (!sent){
        document.body.classList.remove('footer-at-top', 'footer-overlap');
        return;
      }
      const header = document.querySelector<HTMLElement>('header.site');
      if (!header) return;
      const EPS = 24;
      const h = header.getBoundingClientRect().height || 0;
      const top = sent.getBoundingClientRect().top;
      const atTop = top <= EPS;
      const overlap = !atTop && top <= (h + EPS);
      document.body.classList.toggle('footer-at-top', atTop);
      document.body.classList.toggle('footer-overlap', overlap);
    };
    // Double RAF to let Next.js mount and CSS apply
    requestAnimationFrame(() => requestAnimationFrame(recalc));
    // Also do an immediate best-effort in case there’s no animation
    recalc();
  }, [pathname]);

  return null;
}
