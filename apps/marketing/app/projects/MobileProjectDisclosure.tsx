'use client';

import type { ReactNode } from 'react';
import { Disclosure } from '@/components/marketing-foundation/Disclosure';

type MobileProjectDisclosureProps = {
  bodyClassName?: string;
  children: ReactNode;
  className: string;
  desktopMinWidth?: 641 | 721 | 900;
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
  return (
    <Disclosure
      bodyClassName={bodyClassName}
      className={className}
      data-project-mobile-disclosure={kind}
      desktopMinWidth={desktopMinWidth}
      icon={null}
      mode="desktop-expanded"
      summary={summary}
      unstyled
    >
      {children}
    </Disclosure>
  );
}
