'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function updateFooterHeaderState(
  header: HTMLElement | null,
  sent: HTMLElement | null,
  EPS: number,
) {
  if (typeof window === 'undefined') return;

  if (!header || !sent) {
    document.body.classList.remove('footer-at-top', 'footer-overlap');
    return;
  }

  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  // If we are at the very top of the page, always use the default header palette
  if (scrollTop <= EPS) {
    document.body.classList.remove('footer-at-top', 'footer-overlap');
    return;
  }

  const h = header.getBoundingClientRect().height || 0;
  const top = sent.getBoundingClientRect().top;

  const atTop = top <= EPS;
  const overlap = !atTop && top <= (h + EPS);

  if (!atTop && !overlap) {
    document.body.classList.remove('footer-at-top', 'footer-overlap');
    return;
  }

  document.body.classList.toggle('footer-at-top', atTop);
  document.body.classList.toggle('footer-overlap', overlap);
}

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
      updateFooterHeaderState(header, sent!, EPS);
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
      const header = document.querySelector<HTMLElement>('header.site');
      const EPS = 24;
      updateFooterHeaderState(header, sent, EPS);
    };
    // Double RAF to let Next.js mount and CSS apply
    requestAnimationFrame(() => requestAnimationFrame(recalc));
    // Also do an immediate best-effort in case there’s no animation
    recalc();
  }, [pathname]);

  return null;
}
