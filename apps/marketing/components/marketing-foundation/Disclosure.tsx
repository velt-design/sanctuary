'use client';

import {
  type DetailsHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import styles from './Interactions.module.css';

type DisclosureMode = 'manual' | 'desktop-expanded';

type DisclosureProps = Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  'children' | 'defaultOpen' | 'onToggle' | 'open'
> & {
  bodyClassName?: string;
  children: ReactNode;
  desktopMinWidth?: number;
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
  const [isDesktop, setIsDesktop] = useState(responsive);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!responsive) return;

    const media = window.matchMedia(`(min-width: ${desktopMinWidth}px)`);
    const syncViewport = () => setIsDesktop(media.matches);

    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, [desktopMinWidth, responsive]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const open = event.currentTarget.open;
    if (responsive && !isDesktop) setIsMobileOpen(open);
    onOpenChange?.(open);
  };

  const stateProps = responsive ? { open: isDesktop || isMobileOpen } : {};

  return (
    <details
      {...detailsProps}
      {...stateProps}
      className={cn(!unstyled && styles.disclosure, className)}
      data-disclosure={mode}
      onToggle={handleToggle}
    >
      <summary className={cn(!unstyled && styles.disclosureSummary, summaryClassName)}>
        {summary}
        {icon === undefined ? (
          <span className={cn(!unstyled && styles.disclosureIcon)} aria-hidden="true" />
        ) : icon}
      </summary>
      <div className={cn(!unstyled && styles.disclosureBody, bodyClassName)}>
        {children}
      </div>
    </details>
  );
}
