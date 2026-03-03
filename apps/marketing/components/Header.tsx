'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  START_MODAL_VISIBILITY_EVENT,
  type StartModalVisibilityDetail,
  isStartModalOpen,
} from '@/lib/startModalBridge';

const mobileNavItems = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/projects', label: 'Projects' },
  { href: '/contact', label: 'Contact' },
];

const HEADER_SCROLL_THRESHOLD_PX = 12;
const HEADER_DIRECTION_SAMPLE_COUNT = 2;

function DesktopQuickEstimateCta({ disableExpand }: { disableExpand?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (disableExpand) return;
    const timerId = window.setTimeout(() => setExpanded(true), 500);
    return () => window.clearTimeout(timerId);
  }, [disableExpand]);

  return (
    <Link href="/contact" className={`nav-cta ${expanded ? 'expanded' : ''}`}>
      <span className="nav-cta__label">Quick Estimate</span>
    </Link>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [startHeaderVisible, setStartHeaderVisible] = useState(false);
  const [startHeaderSuppressed, setStartHeaderSuppressed] = useState(false);
  const pathname = usePathname();
  const isStartRoute = pathname?.startsWith('/start') ?? false;
  const startModalSuppressedRef = useRef(false);
  const scrollStateRef = useRef({
    lastY: 0,
    upDelta: 0,
    downDelta: 0,
    direction: 0 as -1 | 0 | 1,
    directionSamples: 0,
  });

  const resetScrollTracking = useCallback(() => {
    if (typeof window === 'undefined') return;

    scrollStateRef.current = {
      lastY: window.scrollY,
      upDelta: 0,
      downDelta: 0,
      direction: 0,
      directionSamples: 0,
    };
  }, []);

  const hideStartHeader = useCallback(() => {
    setStartHeaderVisible(false);
    resetScrollTracking();
  }, [resetScrollTracking]);

  // Hydration flag for mobile menu portal mounting.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isStartRoute) {
      startModalSuppressedRef.current = false;
      setStartHeaderSuppressed(false);
      setStartHeaderVisible(false);
      return;
    }

    hideStartHeader();
  }, [hideStartHeader, isStartRoute]);

  useEffect(() => {
    if (!isStartRoute) return;

    const applySuppressedState = (open: boolean) => {
      startModalSuppressedRef.current = open;
      setStartHeaderSuppressed(open);
      hideStartHeader();
    };

    applySuppressedState(isStartModalOpen());

    const onModalVisibility = (event: Event) => {
      const detail = (event as CustomEvent<StartModalVisibilityDetail>).detail;
      if (typeof detail?.open === 'boolean') {
        applySuppressedState(detail.open);
        return;
      }

      applySuppressedState(isStartModalOpen());
    };

    window.addEventListener(START_MODAL_VISIBILITY_EVENT, onModalVisibility);
    return () => {
      window.removeEventListener(START_MODAL_VISIBILITY_EVENT, onModalVisibility);
    };
  }, [hideStartHeader, isStartRoute]);

  useEffect(() => {
    if (!isStartRoute) return;

    let rafId = 0;
    const onScrollSample = () => {
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (startModalSuppressedRef.current) return;

        const state = scrollStateRef.current;
        const currentY = window.scrollY;
        const delta = currentY - state.lastY;

        if (Math.abs(delta) < 1) return;
        state.lastY = currentY;

        if (currentY <= 4) {
          state.upDelta = 0;
          state.downDelta = 0;
          state.direction = 0;
          state.directionSamples = 0;
          setStartHeaderVisible(false);
          return;
        }

        const direction: -1 | 1 = delta > 0 ? 1 : -1;
        if (state.direction === direction) {
          state.directionSamples += 1;
        } else {
          state.direction = direction;
          state.directionSamples = 1;
        }

        if (direction === -1) {
          state.upDelta += Math.abs(delta);
          state.downDelta = 0;

          if (state.directionSamples >= HEADER_DIRECTION_SAMPLE_COUNT && state.upDelta >= HEADER_SCROLL_THRESHOLD_PX) {
            setStartHeaderVisible(true);
            state.upDelta = 0;
          }

          return;
        }

        state.downDelta += delta;
        state.upDelta = 0;
        if (state.directionSamples >= HEADER_DIRECTION_SAMPLE_COUNT && state.downDelta >= HEADER_SCROLL_THRESHOLD_PX) {
          setStartHeaderVisible(false);
          state.downDelta = 0;
        }
      });
    };

    hideStartHeader();
    window.addEventListener('scroll', onScrollSample, { passive: true });
    window.addEventListener('resize', onScrollSample, { passive: true });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', onScrollSample);
      window.removeEventListener('resize', onScrollSample);
    };
  }, [hideStartHeader, isStartRoute]);

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

  const headerClassName = [
    'site',
    isStartRoute ? 'site--start-scroll' : '',
    isStartRoute && startHeaderVisible && !startHeaderSuppressed ? 'site--start-visible' : '',
    isStartRoute && startHeaderSuppressed ? 'site--start-suppressed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header className={headerClassName}>
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
          <div className="header-actions">
            <DesktopQuickEstimateCta
              key={pathname}
              disableExpand={typeof pathname === 'string' && pathname.startsWith('/contact')}
            />
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
