'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { NAV_ITEMS, SIDEBAR_WIDTH_PX } from './navItems';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import styles from './SidebarRevealOverlayLab.module.css';

const OVERLAY_WIDTH_PX = 262;
const LABEL_LAYER_WIDTH_PX = OVERLAY_WIDTH_PX - SIDEBAR_WIDTH_PX;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function itemChildren(item: (typeof NAV_ITEMS)[number]) {
  return 'children' in item ? item.children : undefined;
}

function isParentActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const aliases: Record<string, string[]> = {
    '/projects': ['/staff/projects'],
    '/contacts': ['/staff/contacts'],
    '/schedule': ['/staff/schedule'],
    '/imports': ['/admin/imports'],
    '/pricebook': ['/admin/costs'],
  };

  const matches = aliases[href];
  if (!matches) return false;
  return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return prefersReducedMotion;
}

function isChildActive(
  parentKey: string,
  childKey: string,
  pathname: string,
  scheduleView: string,
  hashValue: string,
) {
  switch (parentKey) {
    case 'projects': {
      if (childKey === 'all-projects') return pathname === '/projects' || pathname === '/staff/projects';
      if (childKey === 'new-project') return pathname === '/projects/new' || pathname === '/staff/projects/new';
      if (childKey === 'design-list') {
        return pathname === '/staff/projects/design-packages' || pathname.startsWith('/staff/projects/design-packages/');
      }
      if (childKey === 'running-jobs') {
        return (
          pathname === '/staff/projects/running-jobs' ||
          pathname.startsWith('/staff/projects/running-jobs/') ||
          pathname === '/staff/running-jobs' ||
          pathname.startsWith('/staff/running-jobs/')
        );
      }
      return false;
    }
    case 'contacts': {
      if (childKey === 'all-contacts') return pathname === '/contacts' || pathname === '/staff/contacts';
      if (childKey === 'new-contact') return pathname === '/contacts/new' || pathname === '/staff/contacts/new';
      return false;
    }
    case 'schedule': {
      const schedulePath =
        pathname === '/schedule' ||
        pathname.startsWith('/schedule/') ||
        pathname === '/staff/schedule' ||
        pathname.startsWith('/staff/schedule/');
      if (!schedulePath) return false;

      if (childKey === 'schedule-board') return scheduleView === 'board';
      if (childKey === 'schedule-gantt') return scheduleView === 'gantt';
      if (childKey === 'schedule-site-visits') return scheduleView === 'site-visits';
      return false;
    }
    case 'pricebook': {
      const onPricebookPath =
        pathname === '/pricebook' ||
        pathname.startsWith('/pricebook/') ||
        pathname.startsWith('/admin/costs/');
      if (!onPricebookPath) return false;

      if (childKey === 'pricebook-actions') {
        return hashValue === '#actions' || pathname.startsWith('/admin/costs/actions');
      }
      if (childKey === 'pricebook-overheads') {
        return hashValue === '#overheads' || pathname.startsWith('/admin/costs/overheads');
      }
      if (childKey === 'pricebook-materials') {
        return hashValue === '#materials' || hashValue === '' || pathname.startsWith('/admin/costs/materials');
      }
      return false;
    }
    default:
      return false;
  }
}

export default function SidebarRevealOverlayLab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = usePortalSession();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const pointerInRailRef = useRef(false);
  const pointerInOverlayRef = useRef(false);
  const focusWithinRef = useRef(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const railElementRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const labelNavRef = useRef<HTMLDivElement | null>(null);
  const parentRowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const iconSyncRafRef = useRef<number | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [openParentKey, setOpenParentKey] = useState<string | null>(null);
  const submenuOpenTimerRef = useRef<number | null>(null);
  const submenuCloseTimerRef = useRef<number | null>(null);
  const [hashValue, setHashValue] = useState('');
  const prevRouteKeyRef = useRef<string | null>(null);

  const submenuEnabled = true;
  const scheduleView = (searchParams.get('view') || 'board').toLowerCase();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}#${hashValue}`,
    [hashValue, pathname, searchParams],
  );

  const setParentRowRef = useCallback(
    (key: string) => (node: HTMLAnchorElement | null) => {
      if (node) {
        parentRowRefs.current.set(key, node);
        return;
      }
      parentRowRefs.current.delete(key);
    },
    [],
  );

  useEffect(() => {
    const readHash = () => setHashValue(window.location.hash.toLowerCase());
    readHash();
    window.addEventListener('hashchange', readHash);
    window.addEventListener('popstate', readHash);
    return () => {
      window.removeEventListener('hashchange', readHash);
      window.removeEventListener('popstate', readHash);
    };
  }, []);

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearExpandTimers = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
  }, [clearTimer]);

  const clearSubmenuTimers = useCallback(() => {
    clearTimer(submenuOpenTimerRef);
    clearTimer(submenuCloseTimerRef);
  }, [clearTimer]);

  const clearIconShiftVars = useCallback(() => {
    const railElement = railElementRef.current;
    if (!railElement) return;
    visibleItems.forEach((item) => {
      railElement.style.removeProperty(`--icon-shift-${item.key}`);
    });
  }, [visibleItems]);

  const syncIconShifts = useCallback(() => {
    const railElement = railElementRef.current;
    const labelLayerElement = labelLayerRef.current;
    if (!railElement || !labelLayerElement) return;

    const layerTop = labelLayerElement.getBoundingClientRect().top;
    const baseTopStart = 8;
    const rowStep = 52;

    visibleItems.forEach((item, index) => {
      const rowElement = parentRowRefs.current.get(item.key);
      if (!rowElement) return;
      const rowTop = rowElement.getBoundingClientRect().top - layerTop;
      const shift = Math.round((rowTop - (baseTopStart + index * rowStep)) * 100) / 100;
      railElement.style.setProperty(`--icon-shift-${item.key}`, `${shift}px`);
    });
  }, [visibleItems]);

  const runIconSyncFor = useCallback(
    (durationMs: number) => {
      if (iconSyncRafRef.current !== null) {
        cancelAnimationFrame(iconSyncRafRef.current);
        iconSyncRafRef.current = null;
      }
      const start = performance.now();
      const tick = (now: number) => {
        syncIconShifts();
        if (now - start < durationMs) {
          iconSyncRafRef.current = requestAnimationFrame(tick);
          return;
        }
        iconSyncRafRef.current = null;
      };
      iconSyncRafRef.current = requestAnimationFrame(tick);
    },
    [syncIconShifts],
  );

  useEffect(() => clearExpandTimers, [clearExpandTimers]);
  useEffect(() => clearSubmenuTimers, [clearSubmenuTimers]);
  useEffect(
    () => () => {
      if (iconSyncRafRef.current !== null) cancelAnimationFrame(iconSyncRafRef.current);
    },
    [],
  );

  const isPointerInside = useCallback(
    () => pointerInRailRef.current || pointerInOverlayRef.current,
    [],
  );

  const syncInteractionStateFromDom = useCallback(() => {
    const railElement = railElementRef.current;
    const overlayElement = overlayRef.current;

    const pointerInRail = Boolean(railElement?.matches(':hover'));
    const pointerInOverlay = Boolean(overlayElement?.matches(':hover'));
    pointerInRailRef.current = pointerInRail;
    pointerInOverlayRef.current = pointerInOverlay;

    const activeElement = document.activeElement;
    const focusInside =
      activeElement instanceof Node &&
      ((railElement?.contains(activeElement) ?? false) || (overlayElement?.contains(activeElement) ?? false));
    focusWithinRef.current = Boolean(focusInside);

    return {
      pointerInside: pointerInRail || pointerInOverlay,
      focusInside: Boolean(focusInside),
    };
  }, []);

  const openDelay = prefersReducedMotion ? 0 : 90;
  const closeDelay = prefersReducedMotion ? 0 : 170;
  const submenuOpenDelay = prefersReducedMotion ? 0 : 200;
  const submenuCloseDelay = prefersReducedMotion ? 0 : 260;

  const activeParentKey = useMemo(() => {
    const parentWithActiveChild = visibleItems.find((item) =>
      itemChildren(item)?.some((child) => isChildActive(item.key, child.key, pathname, scheduleView, hashValue)),
    );
    return parentWithActiveChild?.key ?? null;
  }, [hashValue, pathname, scheduleView, visibleItems]);

  const openNow = useCallback(() => {
    clearTimer(closeTimerRef);
    clearTimer(openTimerRef);
    setExpanded(true);
  }, [clearTimer]);

  const closeNow = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
    clearSubmenuTimers();
    pointerInRailRef.current = false;
    pointerInOverlayRef.current = false;
    setHoveredKey(null);
    setOpenParentKey(null);
    setExpanded(false);
  }, [clearSubmenuTimers, clearTimer]);

  useEffect(() => {
    const previousRouteKey = prevRouteKeyRef.current;
    prevRouteKeyRef.current = routeKey;
    if (!previousRouteKey || previousRouteKey === routeKey) return;

    clearSubmenuTimers();
    setHoveredKey(null);
    setOpenParentKey(null);
    closeNow();
  }, [clearSubmenuTimers, closeNow, routeKey]);

  const scheduleOpen = useCallback(() => {
    clearTimer(closeTimerRef);
    if (expanded) return;
    clearTimer(openTimerRef);
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setExpanded(true);
    }, openDelay);
  }, [clearTimer, expanded, openDelay]);

  const scheduleClose = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      const { pointerInside, focusInside } = syncInteractionStateFromDom();
      if (pointerInside || focusInside) return;
      clearSubmenuTimers();
      setHoveredKey(null);
      setOpenParentKey(null);
      setExpanded(false);
    }, closeDelay);
  }, [clearSubmenuTimers, clearTimer, closeDelay, syncInteractionStateFromDom]);

  const scheduleSubmenuOpen = useCallback(
    (key: string) => {
      clearTimer(submenuCloseTimerRef);
      clearTimer(submenuOpenTimerRef);
      submenuOpenTimerRef.current = window.setTimeout(() => {
        submenuOpenTimerRef.current = null;
        setOpenParentKey(key);
      }, submenuOpenDelay);
    },
    [clearTimer, submenuOpenDelay],
  );

  const scheduleSubmenuClose = useCallback(
    (key: string) => {
      clearTimer(submenuOpenTimerRef);
      clearTimer(submenuCloseTimerRef);
      submenuCloseTimerRef.current = window.setTimeout(() => {
        submenuCloseTimerRef.current = null;
        setOpenParentKey((current) => (current === key ? activeParentKey : current));
      }, submenuCloseDelay);
    },
    [activeParentKey, clearTimer, submenuCloseDelay],
  );

  useEffect(() => {
    if (!expanded || !submenuEnabled) {
      setOpenParentKey(null);
      return;
    }
    if (!activeParentKey) return;
    setOpenParentKey((current) => current ?? activeParentKey);
  }, [activeParentKey, expanded, submenuEnabled]);

  const handleMouseEnter = useCallback(() => {
    pointerInOverlayRef.current = true;
    scheduleOpen();
  }, [scheduleOpen]);

  const handleMouseLeave = useCallback(() => {
    pointerInOverlayRef.current = false;
    setHoveredKey(null);
    scheduleClose();
  }, [scheduleClose]);

  const handleFocusCapture = useCallback(() => {
    focusWithinRef.current = true;
    openNow();
  }, [openNow]);

  const handleBlurCapture = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
      focusWithinRef.current = false;
      if (!isPointerInside()) closeNow();
    },
    [closeNow, isPointerInside],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape') return;
      focusWithinRef.current = false;
      closeNow();
      railElementRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    },
    [closeNow],
  );

  useEffect(() => {
    const railElement = document.querySelector<HTMLElement>('[data-portal-sidebar-rail="true"]');
    railElementRef.current = railElement;
    if (!railElement) return;

    const onRailMouseEnter = () => {
      pointerInRailRef.current = true;
      scheduleOpen();
    };

    const onRailMouseOver = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLElement>('[data-nav-key]');
      if (!link || !railElement.contains(link)) return;
      setHoveredKey((prev) => (prev === link.dataset.navKey ? prev : link.dataset.navKey ?? null));
    };

    const onRailMouseLeave = () => {
      pointerInRailRef.current = false;
      setHoveredKey(null);
      scheduleClose();
    };

    const onRailFocusIn = (event: globalThis.FocusEvent) => {
      focusWithinRef.current = true;
      const target = event.target;
      if (target instanceof Element) {
        const link = target.closest<HTMLElement>('[data-nav-key]');
        if (link && railElement.contains(link)) setHoveredKey(link.dataset.navKey ?? null);
      }
      openNow();
    };

    const onRailFocusOut = (event: globalThis.FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && railElement.contains(nextTarget)) return;
      if (nextTarget instanceof Node && overlayRef.current?.contains(nextTarget)) return;
      focusWithinRef.current = false;
      setHoveredKey(null);
      if (!isPointerInside()) closeNow();
    };

    railElement.addEventListener('mouseenter', onRailMouseEnter);
    railElement.addEventListener('mouseover', onRailMouseOver);
    railElement.addEventListener('mouseleave', onRailMouseLeave);
    railElement.addEventListener('focusin', onRailFocusIn);
    railElement.addEventListener('focusout', onRailFocusOut);

    return () => {
      railElement.removeEventListener('mouseenter', onRailMouseEnter);
      railElement.removeEventListener('mouseover', onRailMouseOver);
      railElement.removeEventListener('mouseleave', onRailMouseLeave);
      railElement.removeEventListener('focusin', onRailFocusIn);
      railElement.removeEventListener('focusout', onRailFocusOut);
    };
  }, [closeNow, isPointerInside, openNow, scheduleClose, scheduleOpen]);

  useEffect(() => {
    const railElement = railElementRef.current;
    if (!railElement) return;
    if (expanded) {
      railElement.setAttribute('data-reveal-expanded', 'true');
      return () => railElement.removeAttribute('data-reveal-expanded');
    }
    railElement.removeAttribute('data-reveal-expanded');
    clearIconShiftVars();
    return;
  }, [clearIconShiftVars, expanded]);

  useLayoutEffect(() => {
    if (!expanded || !submenuEnabled) {
      clearIconShiftVars();
      return;
    }

    runIconSyncFor(220);

    const labelNavElement = labelNavRef.current;
    if (!labelNavElement) return;

    let rafId = 0;
    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        syncIconShifts();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(labelNavElement);
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleSync);
    };
  }, [clearIconShiftVars, expanded, openParentKey, runIconSyncFor, submenuEnabled, syncIconShifts]);

  return (
    <div
      ref={overlayRef}
      className={cx(styles.overlay, expanded && styles.overlayExpanded)}
      style={{ width: LABEL_LAYER_WIDTH_PX }}
      aria-label="Sidebar reveal lab"
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={labelLayerRef}
        className={cx(styles.labelLayer, expanded && styles.labelLayerExpanded)}
        aria-hidden={!expanded}
      >
        <div ref={labelNavRef} className={styles.labelNav}>
          {visibleItems.map((item) => {
            const children = itemChildren(item);
            const hasSubmenu = submenuEnabled && Boolean(children?.length);
            const isParentCurrent =
              isParentActive(pathname, item.href) ||
              Boolean(children?.some((child) => isChildActive(item.key, child.key, pathname, scheduleView, hashValue)));
            const isBubbled = hoveredKey === item.key || isParentCurrent;
            const isSubmenuOpen = openParentKey === item.key && hasSubmenu;

            return (
              <div
                key={item.key}
                className={styles.parentGroup}
                onMouseEnter={() => {
                  setHoveredKey(item.key);
                  if (!hasSubmenu) return;
                  scheduleSubmenuOpen(item.key);
                }}
                onMouseLeave={() => {
                  if (!hasSubmenu) return;
                  scheduleSubmenuClose(item.key);
                }}
              >
                <Link
                  href={item.href}
                  aria-current={isParentCurrent ? 'page' : undefined}
                  className={cx(styles.parentRow, isBubbled && styles.parentRowBubbled)}
                  ref={setParentRowRef(item.key)}
                  tabIndex={expanded ? 0 : -1}
                  onFocus={() => {
                    setHoveredKey(item.key);
                    if (!hasSubmenu) return;
                    setOpenParentKey(item.key);
                  }}
                >
                  <span className={styles.parentLabel}>{item.label}</span>
                  {hasSubmenu ? (
                    <ChevronDown
                      aria-hidden="true"
                      className={cx(styles.chevron, isSubmenuOpen && styles.chevronOpen)}
                    />
                  ) : null}
                </Link>

                {hasSubmenu ? (
                  <div className={cx(styles.submenu, isSubmenuOpen && styles.submenuOpen)}>
                    <div className={styles.submenuInner}>
                      {children?.map((child) => {
                        const childActive = isChildActive(item.key, child.key, pathname, scheduleView, hashValue);
                        return (
                          <Link
                            key={child.key}
                            href={child.href}
                            aria-current={childActive ? 'page' : undefined}
                            className={cx(styles.childRow, childActive && styles.childRowActive)}
                            tabIndex={expanded ? 0 : -1}
                            onFocus={() => {
                              setHoveredKey(item.key);
                              setOpenParentKey(item.key);
                            }}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
