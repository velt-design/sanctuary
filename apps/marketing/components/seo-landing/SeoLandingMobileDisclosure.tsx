'use client';

import type { ReactNode } from 'react';
import { Disclosure } from '@/components/marketing-foundation';

type SeoLandingMobileDisclosureProps = {
  children: ReactNode;
  groupId: string;
  summary: string;
};

export default function SeoLandingMobileDisclosure({
  children,
  groupId,
  summary,
}: SeoLandingMobileDisclosureProps) {
  return (
    <Disclosure
      bodyClassName="seo-landing__mobile-disclosure-body"
      className="seo-landing__mobile-disclosure"
      data-seo-landing-disclosure={groupId}
      desktopMinWidth={721}
      icon={<span className="seo-landing__mobile-disclosure-icon" aria-hidden="true" />}
      mode="desktop-expanded"
      summary={<span data-seo-landing-disclosure-label>{summary}</span>}
      summaryClassName="seo-landing__mobile-disclosure-summary"
      unstyled
    >
      {children}
    </Disclosure>
  );
}
