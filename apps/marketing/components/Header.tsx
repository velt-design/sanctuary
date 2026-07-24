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
  inferEnquiryAudience,
} from '@/lib/enquiryContext';
import {
  getDesktopHeaderNavigation,
  getMobileHeaderNavigation,
} from './headerNavigation';

const HEADER_SCROLL_THRESHOLD_PX = 12;
const HEADER_DIRECTION_SAMPLE_COUNT = 2;
const HERO_HEADER_SOLID_SCROLL_PX = 24;
const DESKTOP_MENU_MEDIA_QUERY = '(min-width: 901px)';
const MENU_FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
].join(',');
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
  const currentPath = pathname ?? '/';
  const desktopNavigationItems = getDesktopHeaderNavigation(currentPath);
  const mobileNavigationItems = getMobileHeaderNavigation(currentPath);
  const headerEnquiryHref = buildEnquiryHref({
    enquiryType: inferEnquiryAudience(currentPath),
    sourcePath: currentPath,
    sourceComponent: 'header',
  });
  const isStartRoute = pathname?.startsWith('/start') ?? false;
  const isHeroOverlayRoute = heroOverlayRoutes.has(pathname ?? '');
  const startModalSuppressedRef = useRef(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const mobileMenuScrollYRef = useRef(0);
  const mobileMenuScrollCapturedRef = useRef(false);
  const mobileMenuOpenedAtPathRef = useRef(currentPath);
  const restoreMobileMenuScrollRef = useRef(true);
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

  const closeMobileMenu = useCallback(({
    restoreFocus = false,
    restoreScroll = true,
  }: {
    restoreFocus?: boolean;
    restoreScroll?: boolean;
  } = {}) => {
    restoreMobileMenuScrollRef.current = restoreScroll;
    setMobileMenuOpen(false);
    if (restoreFocus) mobileToggleRef.current?.focus();
  }, []);

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
    if (
      mobileMenuOpen
      && mobileMenuOpenedAtPathRef.current !== currentPath
    ) {
      closeMobileMenu({ restoreScroll: false });
    }
  }, [closeMobileMenu, currentPath, mobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu({ restoreFocus: true });
        return;
      }

      if (event.key !== 'Tab') return;

      const menuLinks = Array.from(
        mobileMenuRef.current?.querySelectorAll<HTMLElement>(
          MENU_FOCUSABLE_SELECTOR,
        ) ?? [],
      );
      const focusOrder = [
        mobileToggleRef.current,
        ...menuLinks,
      ].filter((element): element is HTMLElement => element !== null);
      if (focusOrder.length === 0) return;

      const currentIndex = focusOrder.indexOf(document.activeElement as HTMLElement);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = currentIndex < 0
        ? (event.shiftKey ? focusOrder.length - 1 : 0)
        : (currentIndex + direction + focusOrder.length) % focusOrder.length;

      event.preventDefault();
      focusOrder[nextIndex]?.focus();
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      const focusFrame = window.requestAnimationFrame(() => (
        firstMobileLinkRef.current?.focus()
      ));
      const closeOnHistoryNavigation = () => {
        closeMobileMenu({ restoreScroll: false });
      };
      window.addEventListener('popstate', closeOnHistoryNavigation);

      return () => {
        window.cancelAnimationFrame(focusFrame);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', closeOnHistoryNavigation);
      };
    }

    return undefined;
  }, [closeMobileMenu, mobileMenuOpen]);

  useEffect(() => {
    const desktopMedia = window.matchMedia(DESKTOP_MENU_MEDIA_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        closeMobileMenu();
      }
    };

    closeOnDesktop(desktopMedia);
    desktopMedia.addEventListener('change', closeOnDesktop);
    return () => desktopMedia.removeEventListener('change', closeOnDesktop);
  }, [closeMobileMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const body = document.body;
    const scrollY = mobileMenuScrollYRef.current;
    const previousInlineStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const bodyHadNoScroll = body.classList.contains('no-scroll');
    const bodyHadMobileMenuOpen = body.classList.contains('mobile-menu-open');

    body.classList.add('no-scroll', 'mobile-menu-open');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      if (!bodyHadNoScroll) body.classList.remove('no-scroll');
      if (!bodyHadMobileMenuOpen) body.classList.remove('mobile-menu-open');
      body.style.position = previousInlineStyle.position;
      body.style.top = previousInlineStyle.top;
      body.style.left = previousInlineStyle.left;
      body.style.right = previousInlineStyle.right;
      body.style.width = previousInlineStyle.width;

      if (restoreMobileMenuScrollRef.current) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [mobileMenuOpen]);

  const handleCircleToggle = () => {
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia(DESKTOP_MENU_MEDIA_QUERY).matches;
    if (isDesktop) return;
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }

    if (!mobileMenuScrollCapturedRef.current) {
      mobileMenuScrollYRef.current = window.scrollY;
    }
    mobileMenuScrollCapturedRef.current = false;
    mobileMenuOpenedAtPathRef.current = currentPath;
    restoreMobileMenuScrollRef.current = true;
    setMobileMenuOpen(true);
  };

  const captureMobileMenuScroll = () => {
    if (mobileMenuOpen) return;
    mobileMenuScrollYRef.current = window.scrollY;
    mobileMenuScrollCapturedRef.current = true;
  };

  const handleMobileToggleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      captureMobileMenuScroll();
    }
  };

  const handleMobileNavigation = () => {
    closeMobileMenu({ restoreScroll: false });
  };

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
                  {desktopNavigationItems.slice(0, 2).map((item) => (
                    <li key={item.id}>
                      <Link
                        className={`navlink-btn ${item.current ? 'active' : ''}`}
                        href={item.href}
                        aria-current={item.current ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <ul className="nav-list__cluster nav-list__cluster--right">
                  {desktopNavigationItems.slice(2).map((item) => (
                    <li key={item.id}>
                      <Link
                        id={item.id === 'products' ? 'nav-products' : undefined}
                        className={`navlink-btn ${item.current ? 'active' : ''}`}
                        href={item.href}
                        aria-label={item.desktopLabel}
                        aria-current={item.current ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
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
              onKeyDown={handleMobileToggleKeyDown}
              onPointerDown={captureMobileMenuScroll}
              onPointerCancel={() => {
                mobileMenuScrollCapturedRef.current = false;
              }}
            >
              <span className="mobile-toggle__pulse" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {mounted && createPortal(
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
          aria-hidden={!mobileMenuOpen}
          data-mobile-menu-state={mobileMenuOpen ? 'open' : 'closed'}
          inert={!mobileMenuOpen}
        >
          <nav aria-label="Mobile primary" className="mobile-nav">
            <ul className="mobile-menu__list">
              {mobileNavigationItems.map((item, index) => (
                <li key={item.id}>
                  <Link
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    href={item.href}
                    className="mobile-menu__link"
                    aria-current={item.current ? 'page' : undefined}
                    onClick={handleMobileNavigation}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={headerEnquiryHref}
                  className="mobile-menu__link mobile-menu__link--estimate"
                  data-homepage-event="header_estimate_click"
                  onClick={handleMobileNavigation}
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
