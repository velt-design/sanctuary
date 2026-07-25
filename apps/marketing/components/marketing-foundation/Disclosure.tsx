'use client';

import {
  type DetailsHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import styles from './Interactions.module.css';

type DisclosureMode = 'manual' | 'desktop-expanded';
type DisclosureDesktopMinWidth = 641 | 721 | 900;
type DisclosureViewportState = 'manual' | 'pending' | 'mobile' | 'desktop';

type DisclosureProps = Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  'children' | 'defaultOpen' | 'onToggle' | 'open'
> & {
  bodyClassName?: string;
  children: ReactNode;
  desktopMinWidth?: DisclosureDesktopMinWidth;
  icon?: ReactNode;
  mode?: DisclosureMode;
  onOpenChange?: (open: boolean) => void;
  summary: ReactNode;
  summaryClassName?: string;
  unstyled?: boolean;
};

/**
 * A single-tree progressive-disclosure contract.
 *
 * Native details/summary owns keyboard operation and expanded state semantics.
 * `desktop-expanded` preserves route layouts that show the complete content on
 * larger screens while using the same content tree as the mobile disclosure.
 */
export function Disclosure({
  bodyClassName,
  children,
  className,
  desktopMinWidth = 641,
  icon,
  mode = 'manual',
  onOpenChange,
  summary,
  summaryClassName,
  unstyled = false,
  ...detailsProps
}: DisclosureProps) {
  const responsive = mode === 'desktop-expanded';
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [viewportState, setViewportState] = useState<DisclosureViewportState>(
    responsive ? 'pending' : 'manual',
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!responsive) return;

    const media = window.matchMedia(`(min-width: ${desktopMinWidth}px)`);
    let firstScrollFrame = 0;
    let secondScrollFrame = 0;

    const findHashTarget = () => {
      const rawId = window.location.hash.slice(1);
      if (!rawId) return null;

      try {
        return document.getElementById(decodeURIComponent(rawId));
      } catch {
        return document.getElementById(rawId);
      }
    };

    const revealHashTarget = () => {
      if (media.matches) return;

      const target = findHashTarget();
      if (!target || !detailsRef.current?.contains(target)) return;

      setIsMobileOpen(true);
      cancelAnimationFrame(firstScrollFrame);
      cancelAnimationFrame(secondScrollFrame);
      firstScrollFrame = requestAnimationFrame(() => {
        secondScrollFrame = requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'start' });
        });
      });
    };

    const syncViewport = () => {
      setViewportState(media.matches ? 'desktop' : 'mobile');
      revealHashTarget();
    };

    syncViewport();
    media.addEventListener('change', syncViewport);
    window.addEventListener('hashchange', revealHashTarget);
    return () => {
      media.removeEventListener('change', syncViewport);
      window.removeEventListener('hashchange', revealHashTarget);
      cancelAnimationFrame(firstScrollFrame);
      cancelAnimationFrame(secondScrollFrame);
    };
  }, [desktopMinWidth, responsive]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const open = event.currentTarget.open;
    if (responsive && viewportState === 'mobile') setIsMobileOpen(open);
    if (!responsive || viewportState !== 'pending') onOpenChange?.(open);
  };

  const stateProps = responsive
    ? { open: viewportState === 'pending' || viewportState === 'desktop' || isMobileOpen }
    : {};

  return (
    <details
      {...detailsProps}
      {...stateProps}
      className={cn(
        responsive && styles.responsiveDisclosure,
        !unstyled && styles.disclosure,
        className,
      )}
      data-disclosure={mode}
      data-disclosure-desktop-min={responsive ? desktopMinWidth : undefined}
      data-disclosure-state={viewportState}
      onToggle={handleToggle}
      ref={detailsRef}
    >
      <summary className={cn(!unstyled && styles.disclosureSummary, summaryClassName)}>
        {summary}
        {icon === undefined ? (
          <span className={cn(!unstyled && styles.disclosureIcon)} aria-hidden="true" />
        ) : icon}
      </summary>
      <div
        className={cn(
          responsive && styles.responsiveDisclosureBody,
          !unstyled && styles.disclosureBody,
          bodyClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
