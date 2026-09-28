'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import { resolveProjectFinderHomeEnquiryContextFromReader } from '../../lib/projectFinderContinuation';
import { PROJECT_FINDER_STATE_EVENT } from '../../lib/projectFinderContract';

// The same URL-owned context resolver used by the global header and footer.
export default function ChallengerEnquiryLink({ initialHref, defaultHref }: { initialHref: string; defaultHref: string }) {
  const [href, setHref] = useState(initialHref);
  useEffect(() => {
    const sync = () => {
      const context = resolveProjectFinderHomeEnquiryContextFromReader(new URLSearchParams(window.location.search));
      setHref(context ? buildEnquiryHref({ ...context, sourceComponent: 'hero' }) : defaultHref);
    };
    sync();
    window.addEventListener(PROJECT_FINDER_STATE_EVENT, sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener(PROJECT_FINDER_STATE_EVENT, sync);
      window.removeEventListener('popstate', sync);
    };
  }, [defaultHref]);
  const enquiryType = new URLSearchParams(href.split('?')[1]).get('enquiry_type') ?? undefined;
  return <Link href={href} data-project-finder-event="project_finder_direct_enquiry_click" data-source-component="hero" data-enquiry-type={enquiryType}>Enquire about your space <ArrowUpRight /></Link>;
}
