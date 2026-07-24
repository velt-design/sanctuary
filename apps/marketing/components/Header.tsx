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
import {
  buildEnquiryHref,
  getHeaderEnquiryContext,
} from '@/lib/enquiryContext';

const mobileNavItems = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/products', label: 'Products' },
  { href: '/contact', label: 'Contact' },
];

const HEADER_SCROLL_THRESHOLD_PX = 12;
const HEADER_DIRECTION_SAMPLE_COUNT = 2;
const HERO_HEADER_SOLID_SCROLL_PX = 24;
const heroOverlayRoutes = new Set([
  '/',
  '/home-v2',
  '/pergola-guides',
  '/pergolas-auckland',
  '/custom-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland',
  '/gable-pergolas-auckland',
  '/pitched-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/pergolas-with-blinds',
  '/acrylic-pergolas-vs-louvre-roofs',
  '/commercial-pergolas-auckland',
]);

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [startHeaderVisible, setStartHeaderVisible] = useState(false);
  const [startHeaderSuppressed, setStartHeaderSuppressed] = useState(false);
  const [heroHeaderScrolled, setHeroHeaderScrolled] = useState(false);
  const pathname = usePathname();
  const headerEnquiryContext = getHeaderEnquiryContext(pathname ?? '');
  const headerEnquiryHref = buildEnquiryHref({
    ...headerEnquiryContext,
    sourceComponent: 'header',
  });
  const mobileEnquiryHref = buildEnquiryHref({
    ...headerEnquiryContext,
    sourceComponent: 'mobile-menu',
  });
  const isStartRoute = pathname?.startsWith('/start') ?? false;
  const isHeroOverlayRoute = heroOverlayRoutes.has(pathname ?? '');
  const startModalSuppressedRef = useRef(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const mobileMenuScrollYRef = useRef(0);
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
    if (!isHeroOverlayRoute) {
      setHeroHeaderScrolled(false);
      return;
    }

    let rafId = 0;
    const syncHeroHeader = () => {
      rafId = 0;
      setHeroHeaderScrolled(window.scrollY > HERO_HEADER_SOLID_SCROLL_PX);
    };
    const scheduleHeroHeaderSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(syncHeroHeader);
    };

    syncHeroHeader();
    window.addEventListener('scroll', scheduleHeroHeaderSync, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleHeroHeaderSync);
    };
  }, [isHeroOverlayRoute, pathname]);

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
        mobileToggleRef.current?.focus();
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => firstMobileLinkRef.current?.focus());
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
    const preserveDocumentScroll = mobileMenuOpen && pathname === '/';
    const scrollY = preserveDocumentScroll ? mobileMenuScrollYRef.current : 0;
    const previousInlineStyle = preserveDocumentScroll
      ? {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
        }
      : null;

    body.classList.toggle('no-scroll', mobileMenuOpen);
    body.classList.toggle('mobile-menu-open', mobileMenuOpen);

    if (preserveDocumentScroll) {
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    }

    return () => {
      body.classList.remove('no-scroll', 'mobile-menu-open');

      if (previousInlineStyle) {
        body.style.position = previousInlineStyle.position;
        body.style.top = previousInlineStyle.top;
        body.style.left = previousInlineStyle.left;
        body.style.right = previousInlineStyle.right;
        body.style.width = previousInlineStyle.width;
        window.scrollTo(0, scrollY);
      }
    };
  }, [mobileMenuOpen, pathname]);

  const handleCircleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches;
    if (isDesktop) return; // no toggle on desktop; menu is always visible
    if (!mobileMenuOpen) mobileMenuScrollYRef.current = window.scrollY;
    setMobileMenuOpen((open) => !open);
  };

  // Clicking Products navigates to /products (handled via Link below).

  const headerClassName = [
    'site',
    isHeroOverlayRoute ? 'site--hero-overlay' : '',
    isHeroOverlayRoute && heroHeaderScrolled ? 'site--hero-scrolled' : '',
    isStartRoute ? 'site--start-scroll' : '',
    isStartRoute && startHeaderVisible && !startHeaderSuppressed ? 'site--start-visible' : '',
    isStartRoute && startHeaderSuppressed ? 'site--start-suppressed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header
        className={headerClassName}
        data-header-ui="architectural-editorial"
        data-hero-navigation={isHeroOverlayRoute ? (heroHeaderScrolled ? 'solid' : 'overlay') : undefined}
      >
        <div className="container navbar">
          <Link href="/" className="site-brand" aria-label="Sanctuary Pergolas home">
            SANCTUARY&nbsp;PERGOLAS
          </Link>
          <nav aria-label="Primary" className="desktop-nav desktop-nav--center">
            <div className="desktop-wipe open">
              <div className="nav-list nav-list--split">
                <ul className="nav-list__cluster nav-list__cluster--left">
                  <li><Link className={`navlink-btn ${pathname === '/' ? 'active' : ''}`} href="/" aria-current={pathname === '/' ? 'page' : undefined}>Home</Link></li>
                  <li><Link className={`navlink-btn ${pathname?.startsWith('/projects') ? 'active' : ''}`} href="/projects" aria-current={pathname?.startsWith('/projects') ? 'page' : undefined}>Projects</Link></li>
                </ul>
                <ul className="nav-list__cluster nav-list__cluster--right">
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
            </div>
          </nav>
          <div className="header-actions">
            <Link
              href={headerEnquiryHref}
              className="nav-cta"
              data-homepage-event="header_estimate_click"
            >
              <span className="nav-cta__label">Get an estimate</span>
            </Link>
            <button
              ref={mobileToggleRef}
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
              {mobileNavItems.map((item, index) => (
                <li key={item.href}>
                  <Link
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    href={item.href}
                    className="mobile-menu__link"
                    aria-current={typeof pathname === 'string' && pathname === item.href ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={mobileEnquiryHref}
                  className="mobile-menu__link mobile-menu__link--estimate"
                  data-homepage-event="header_estimate_click"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get an estimate
                </Link>
              </li>
            </ul>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
