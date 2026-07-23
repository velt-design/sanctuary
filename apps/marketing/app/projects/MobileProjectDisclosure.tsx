'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type MobileProjectDisclosureProps = {
  bodyClassName?: string;
  children: ReactNode;
  className: string;
  desktopMinWidth?: number;
  kind: string;
  summary: ReactNode;
};

export default function MobileProjectDisclosure({
  bodyClassName,
  children,
  className,
  desktopMinWidth = 641,
  kind,
  summary,
}: MobileProjectDisclosureProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${desktopMinWidth}px)`);
    const syncViewport = () => setIsDesktop(media.matches);

    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, [desktopMinWidth]);

  return (
    <details
      className={className}
      data-project-mobile-disclosure={kind}
      open={isDesktop || isMobileOpen}
      onToggle={(event) => {
        if (!isDesktop) setIsMobileOpen(event.currentTarget.open);
      }}
    >
      <summary>{summary}</summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
