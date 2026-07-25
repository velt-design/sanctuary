'use client';

import type { ReactNode } from 'react';
import { Disclosure } from '@/components/marketing-foundation/Disclosure';

export default function MobileServiceDisclosure({
  children,
  kind,
  summary,
}: {
  children: ReactNode;
  kind: string;
  summary: string;
}) {
  return (
    <Disclosure
      className="pergolas-auckland__mobile-disclosure"
      bodyClassName="pergolas-auckland__mobile-disclosure-body"
      desktopMinWidth={721}
      icon={<span className="pergolas-auckland__mobile-disclosure-icon" aria-hidden="true" />}
      mode="desktop-expanded"
      summary={<span>{summary}</span>}
      summaryClassName="pergolas-auckland__mobile-disclosure-summary"
      unstyled
      data-mobile-content-disclosure={kind}
    >
      {children}
    </Disclosure>
  );
}
