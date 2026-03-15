'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
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

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const aliases: Record<string, string[]> = {
    '/projects': ['/staff/projects'],
    '/contacts': ['/staff/contacts'],
    '/schedule': ['/staff/schedule'],
    '/imports': ['/admin/imports'],
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

export default function SidebarRevealOverlayLab() {
  const pathname = usePathname();
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
  }, [clearTimer]);

  const isPointerInside = useCallback(
    () => pointerInRailRef.current || pointerInOverlayRef.current,
    [],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const openDelay = prefersReducedMotion ? 0 : 90;
  const closeDelay = prefersReducedMotion ? 0 : 170;

  const openNow = useCallback(() => {
    clearTimer(closeTimerRef);
    clearTimer(openTimerRef);
    setExpanded(true);
  }, [clearTimer]);

  const closeNow = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
    pointerInRailRef.current = false;
    pointerInOverlayRef.current = false;
    setHoveredKey(null);
    setExpanded(false);
  }, [clearTimer]);

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
      if (isPointerInside() || focusWithinRef.current) return;
      setHoveredKey(null);
      setExpanded(false);
    }, closeDelay);
  }, [clearTimer, closeDelay, isPointerInside]);

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
    return;
  }, [expanded]);

  const hoveredIndex = useMemo(
    () => visibleItems.findIndex((item) => item.key === hoveredKey),
    [hoveredKey, visibleItems],
  );

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
      <div className={cx(styles.labelLayer, expanded && styles.labelLayerExpanded)} aria-hidden={!expanded}>
        <div
          className={cx(styles.hoverBubble, hoveredIndex >= 0 && styles.hoverBubbleVisible)}
          style={hoveredIndex >= 0 ? { top: `${8 + hoveredIndex * 52}px` } : undefined}
          aria-hidden="true"
        />
        <div className={styles.labelNav}>
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(styles.labelRow, active && styles.labelRowActive)}
                tabIndex={expanded ? 0 : -1}
                onMouseEnter={() => setHoveredKey(item.key)}
                onFocus={() => setHoveredKey(item.key)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
