'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

/** Router-owned enquiry anchors retain Back navigation and the next keyboard stop. */
export default function EnquiryLink({ className, children }: { className: string; children: ReactNode }) {
  return <Link className={className} href="#project-details" onNavigate={event => {
    const target = document.getElementById('project-details');
    if (!target) return;
    // Next refreshes an exact same URL instead of scrolling to its fragment again.
    if (window.location.hash === '#project-details') {
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
    }
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }}>{children}</Link>;
}
