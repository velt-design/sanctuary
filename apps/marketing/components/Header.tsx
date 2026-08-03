'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  buildEnquiryHref,
  getCanonicalMarketingPathname,
  getEnquiryRouteContext,
  type EnquiryContext,
} from '@/lib/enquiryContext';
import {
  projectFinderDestinationByDirection,
  resolveProjectFinderHomeDestination,
  resolveProjectFinderHomeEnquiryContextFromReader,
  resolveProjectFinderHomeSelectionFromReader,
  resolveProjectFinderJourneyContextFromReader,
  resolveProjectFinderProjectJourneyContextFromReader,
} from '@/lib/projectFinderContinuation';
import {
  PROJECT_FINDER_STATE_EVENT,
  residentialProjectDirections,
} from '@/lib/projectFinderContract';
import {
  getDesktopHeaderNavigation,
  getMobileHeaderNavigation,
  isHeaderHeroOverlayPath,
  shouldShowDesktopHeaderCta,
} from './headerNavigation';

const HERO_HEADER_SOLID_SCROLL_PX = 24;
const DESKTOP_MENU_MEDIA_QUERY = '(min-width: 901px)';
const PROJECT_FINDER_HOME_DESTINATION_PATHS = new Set([
  '/acrylic-roof-pergolas-auckland',
  '/custom-pergolas-auckland',
  '/commercial-pergolas-auckland',
  '/architects-designers-builders',
]);
const MENU_FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
].join(',');
export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [heroHeaderScrolled, setHeroHeaderScrolled] = useState(false);
  const [projectFinderEnquiryContext, setProjectFinderEnquiryContext] =
    useState<EnquiryContext | null>(null);
  const pathname = usePathname();
  const currentPath = getCanonicalMarketingPathname(pathname);
  const desktopNavigationItems = getDesktopHeaderNavigation(currentPath);
  const mobileNavigationItems = getMobileHeaderNavigation(currentPath);
  const routeEnquiryContext = getEnquiryRouteContext(currentPath);
  const projectFinderDirection = residentialProjectDirections.find(
    (direction) => projectFinderDestinationByDirection[direction] === currentPath,
  );
  const projectFinderProjectSlug = currentPath.match(
    /^\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)$/,
  )?.[1];
  const projectFinderContext = projectFinderEnquiryContext
    && (
      currentPath === '/'
      || PROJECT_FINDER_HOME_DESTINATION_PATHS.has(currentPath)
      || (projectFinderDirection
        && projectFinderEnquiryContext.projectDirection === projectFinderDirection)
      || (projectFinderProjectSlug
        && projectFinderEnquiryContext.sourceProject === projectFinderProjectSlug)
    )
    ? projectFinderEnquiryContext
    : null;
  const headerEnquiryHref = buildEnquiryHref({
    ...routeEnquiryContext,
    ...projectFinderContext,
    sourcePath: currentPath,
    sourceComponent: 'header',
  });
  const headerEnquiryType = projectFinderContext?.enquiryType
    ?? routeEnquiryContext.enquiryType;
  const isHeroOverlayRoute = isHeaderHeroOverlayPath(currentPath);
  const showDesktopCta = shouldShowDesktopHeaderCta(currentPath);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const mobileMenuScrollYRef = useRef(0);
  const mobileMenuScrollCapturedRef = useRef(false);
  const mobileMenuOpenedAtPathRef = useRef(currentPath);
  const restoreMobileMenuScrollRef = useRef(true);

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
    const syncProjectFinderContext = () => {
      const supportsHomeSelection = currentPath === '/'
        || PROJECT_FINDER_HOME_DESTINATION_PATHS.has(currentPath);
      if (
        !supportsHomeSelection
        && !projectFinderDirection
        && !projectFinderProjectSlug
      ) {
        setProjectFinderEnquiryContext(null);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const homeSelection = supportsHomeSelection
        ? resolveProjectFinderHomeSelectionFromReader(params)
        : null;
      const isCompletedHomeSelection = homeSelection
        && (
          homeSelection.direction !== 'commercial-professional'
          || Boolean(homeSelection.professionalPath)
        );
      const homeContext = homeSelection
        && (
          currentPath === '/'
          || (
            isCompletedHomeSelection
            && resolveProjectFinderHomeDestination(homeSelection) === currentPath
          )
        )
        ? resolveProjectFinderHomeEnquiryContextFromReader(params)
        : null;
      if (homeContext) {
        setProjectFinderEnquiryContext(homeContext);
        return;
      }
      const context = projectFinderDirection
        ? resolveProjectFinderJourneyContextFromReader(
            projectFinderDirection,
            params,
          )?.enquiryContext
        : projectFinderProjectSlug
          ? resolveProjectFinderProjectJourneyContextFromReader(
              projectFinderProjectSlug,
              params,
            )?.enquiryContext
          : null;
      setProjectFinderEnquiryContext(context ?? null);
    };

    syncProjectFinderContext();
    window.addEventListener('popstate', syncProjectFinderContext);
    window.addEventListener(PROJECT_FINDER_STATE_EVENT, syncProjectFinderContext);
    return () => {
      window.removeEventListener('popstate', syncProjectFinderContext);
      window.removeEventListener(
        PROJECT_FINDER_STATE_EVENT,
        syncProjectFinderContext,
      );
    };
  }, [currentPath, projectFinderDirection, projectFinderProjectSlug]);

  useEffect(() => {
    if (!isHeroOverlayRoute) {
      setHeroHeaderScrolled(false);
      return;
    }

    let rafId = 0;
    const syncHeroHeader = () => {
      rafId = 0;
      const homepageHeroJourney = currentPath === '/'
        ? document.querySelector<HTMLElement>('[data-homepage-hero-journey]')
        : null;
      const solidThreshold = homepageHeroJourney
        ? homepageHeroJourney.offsetTop + homepageHeroJourney.offsetHeight - 1
        : HERO_HEADER_SOLID_SCROLL_PX;
      setHeroHeaderScrolled(window.scrollY > solidThreshold);
    };
    const scheduleHeroHeaderSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(syncHeroHeader);
    };

    syncHeroHeader();
    window.addEventListener('scroll', scheduleHeroHeaderSync, { passive: true });
    window.addEventListener('resize', scheduleHeroHeaderSync);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleHeroHeaderSync);
      window.removeEventListener('resize', scheduleHeroHeaderSync);
    };
  }, [currentPath, isHeroOverlayRoute]);

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
                    <li
                      key={item.id}
                      className={`nav-list__item nav-list__item--${item.id}`}
                    >
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
                    <li
                      key={item.id}
                      className={`nav-list__item nav-list__item--${item.id}`}
                    >
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
            {showDesktopCta && (currentPath !== '/' || heroHeaderScrolled) ? (
              <Link
                href={headerEnquiryHref}
                className="nav-cta"
                data-homepage-event="header_estimate_click"
                data-enquiry-type={headerEnquiryType}
                data-professional-path={projectFinderContext?.projectProfessionalPath}
                data-project-direction={projectFinderContext?.projectDirection}
                data-project-priorities={projectFinderContext?.projectPriorities?.join(',')}
              >
                <span className="nav-cta__label">Start your project</span>
              </Link>
            ) : null}
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
                  data-enquiry-type={headerEnquiryType}
                  data-professional-path={projectFinderContext?.projectProfessionalPath}
                  data-project-direction={projectFinderContext?.projectDirection}
                  data-project-priorities={projectFinderContext?.projectPriorities?.join(',')}
                  onClick={handleMobileNavigation}
                >
                  Start your project
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
