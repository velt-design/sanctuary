'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export default function EnquiryLink({ className, children }: { className: string; children: ReactNode }) {
  return <Link className={className} href="#project-details" onNavigate={event => {
    // An exact same-URL Next navigation refreshes instead of scrolling to the hash.
    // Keep the router-owned history entry and repeat the native anchor's scroll.
    const target = document.getElementById('project-details');
    if (!target) return;
    if (window.location.hash === '#project-details') {
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
    }
    // Keep the next Tab in the enquiry, on first entry as well as repeat entry.
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }}>{children}</Link>;
}
