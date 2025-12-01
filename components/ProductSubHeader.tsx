'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function ProductSubHeader(){
  const pathname = usePathname();
  const onProductsRoute = typeof pathname === 'string' && pathname.startsWith('/products');
  const onResourcesRoute = typeof pathname === 'string' && (pathname.startsWith('/about') || pathname.startsWith('/blog') || pathname.startsWith('/resources'));

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Keep header/subheader CSS vars in sync with actual DOM on mount and route changes
  useEffect(() => {
    const rootEl = document.documentElement;
    const header = document.querySelector<HTMLElement>('header.site');

    const updateVars = () => {
      const hh = header ? header.offsetHeight || 0 : 0;
      if (hh >= 0) rootEl.style.setProperty('--navH-fix', `${hh}px`);
      const sh = rootRef.current ? rootRef.current.offsetHeight || 0 : 0;
      rootEl.style.setProperty('--subH', `${Math.max(0, sh)}px`);
    };

    // Measure immediately on route change/render
    updateVars();

    // Observe size changes of header and current subheader element
    let ro: ResizeObserver | undefined;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const Ctor = (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver;
      ro = new Ctor(updateVars);
      if (header) ro.observe(header);
      if (rootRef.current) ro.observe(rootRef.current);
    }

    // Also recompute on resize to catch font/layout changes
    window.addEventListener('resize', updateVars);

    // In case the subheader node changes between routes, do a deferred measure
    const raf = window.requestAnimationFrame(updateVars);
    const t = window.setTimeout(updateVars, 120);

    return () => {
      try { if (ro) ro.disconnect(); } catch {}
      window.removeEventListener('resize', updateVars);
      try { window.cancelAnimationFrame(raf); } catch {}
      try { window.clearTimeout(t); } catch {}
      // If we're leaving products/resources, clear the subheader offset
      if (!(onProductsRoute || onResourcesRoute)) {
        try { rootEl.style.setProperty('--subH', '0px'); } catch {}
      }
    };
    // Re-run whenever the route context changes so we re-observe the new subheader element
  }, [pathname, onProductsRoute, onResourcesRoute]);

  if (onResourcesRoute) {
    const resources = [
      {
        href: '/resources',
        label: 'Downloads',
        match: (p: string | null) => !!p && p.startsWith('/resources') && !p.startsWith('/resources/specs-compliance'),
      },
      {
        href: '/resources/specs-compliance',
        label: 'Specs & compliance',
        match: (p: string | null) => !!p && p.startsWith('/resources/specs-compliance'),
      },
      { href: '/about', label: 'About', match: (p: string | null) => !!p && p.startsWith('/about') },
      { href: '/blog', label: 'Blog', match: (p: string | null) => !!p && p.startsWith('/blog') },
    ];

    return (
      <div ref={rootRef} className="product-subheader show" role="navigation" aria-label="Resources shortcuts">
        <div className="product-subheader__inner">
          <ul className="product-subnav">
            {resources.map((r) => {
              const active = r.match(pathname as string);
              return (
                <li className="product-subnav__item" key={r.href}>
                  <Link
                    href={r.href}
                    className={`product-subnav__link${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {r.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  // Hide the products subheader entirely per request
  return null;
}
