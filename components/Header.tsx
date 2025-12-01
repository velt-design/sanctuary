'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';

const mobileNavItems = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/projects', label: 'Projects' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Expose the header height as a CSS variable so pages can offset content
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const headerEl = document.querySelector<HTMLElement>('header.site');
    if (!headerEl) return;

    const setHeaderVar = () => {
      const h = Math.max(0, Math.round(headerEl.getBoundingClientRect().height));
      document.documentElement.style.setProperty('--headerH', `${h}px`);
    };

    setHeaderVar();
    const ro = new ResizeObserver(setHeaderVar);
    ro.observe(headerEl);
    window.addEventListener('resize', setHeaderVar);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setHeaderVar);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.matchMedia('(min-width: 721px)').matches) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle('no-scroll', mobileMenuOpen);
    body.classList.toggle('mobile-menu-open', mobileMenuOpen);
    return () => {
      body.classList.remove('no-scroll', 'mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  const handleCircleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches;
    if (isDesktop) return; // no toggle on desktop; menu is always visible
    setMobileMenuOpen((open) => !open);
  };

  // Clicking Products navigates to /products (handled via Link below).

  return (
    <>
      <header className="site">
        <div className="container navbar">
          <Link href="/" className="site-brand" aria-label="Sanctuary Pergolas home">
            SANCTUARY&nbsp;PERGOLAS
          </Link>
          <nav aria-label="Primary" className="desktop-nav desktop-nav--center">
            <div className="desktop-wipe open">
              <ul className="nav-list">
                <li><Link className={`navlink-btn ${pathname === '/' ? 'active' : ''}`} href="/" aria-current={pathname === '/' ? 'page' : undefined}>Home</Link></li>
                <li><Link className={`navlink-btn ${pathname?.startsWith('/projects') ? 'active' : ''}`} href="/projects" aria-current={pathname?.startsWith('/projects') ? 'page' : undefined}>Projects</Link></li>
                <li>
                  <Link id="nav-products" href="/products" className={`navlink-btn ${pathname?.startsWith('/products') ? 'active' : ''}`} aria-label="Products" aria-current={pathname?.startsWith('/products') ? 'page' : undefined}>
                    Products
                  </Link>
                </li>
                {/* Temporarily hide Resources from nav until content is ready */}
                {/* <li><Link className={`navlink-btn ${(pathname?.startsWith('/about')||pathname?.startsWith('/blog')||pathname?.startsWith('/resources')) ? 'active' : ''}`} href="/resources" aria-current={(pathname?.startsWith('/about')||pathname?.startsWith('/blog')||pathname?.startsWith('/resources')) ? 'page' : undefined}>Resources</Link></li> */}
                <li><Link className={`navlink-btn ${pathname?.startsWith('/contact') ? 'active' : ''}`} href="/contact" aria-current={pathname?.startsWith('/contact') ? 'page' : undefined}>Contact</Link></li>
              </ul>
            </div>
          </nav>
          <button
            type="button"
            className={`mobile-toggle ${mobileMenuOpen ? 'open' : ''}`}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={handleCircleToggle}
          >
            <span className="mobile-toggle__pulse" aria-hidden="true" />
          </button>
        </div>
      </header>

      {mounted && createPortal(
        <div
          id="mobile-menu"
          className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
          aria-hidden={!mobileMenuOpen}
        >
          <nav aria-label="Mobile primary" className="mobile-nav">
            <ul className="mobile-menu__list">
              {mobileNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="mobile-menu__link"
                    aria-current={typeof pathname === 'string' && pathname === item.href ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
