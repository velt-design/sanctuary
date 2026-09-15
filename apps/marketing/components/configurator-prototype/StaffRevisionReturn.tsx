'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import type {PreviewDraft} from './previewDraft';

export function staffRevisionReturnUrl(currentUrl: string, draft: PreviewDraft, development: boolean, configuredOrigin?: string): string | null {
  const current = new URL(currentUrl), project = current.searchParams.get('staff_project'), source = current.searchParams.get('staff_source');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!project || !source || !uuid.test(project) || !uuid.test(source)) return null;
  let origin = 'https://portal.sanctuarypergolas.co.nz';
  if (configuredOrigin) {
    try {
      const trusted = new URL(configuredOrigin);
      if (trusted.protocol === 'https:' && !trusted.username && !trusted.password && trusted.pathname === '/' && !trusted.search && !trusted.hash) origin = trusted.origin;
    } catch { /* Invalid deployment configuration retains the production destination. */ }
  }
  const requested = current.searchParams.get('staff_return_origin');
  if (requested && development && ['localhost','127.0.0.1'].includes(current.hostname)) {
    try {
      const local = new URL(requested);
      if (local.protocol === 'http:' && ['localhost','127.0.0.1'].includes(local.hostname) && !local.username && !local.password) origin = local.origin;
    } catch { /* Invalid return destinations never control navigation. */ }
  }
  const url = new URL(`/staff/projects/${project}/configurator-revision`, origin);
  url.searchParams.set('sourceEstimateId', source);
  url.hash = new URLSearchParams({revisionDraft: JSON.stringify(draft)}).toString();
  return url.toString();
}

export default function StaffRevisionReturn({draft}: {draft: PreviewDraft}) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  useEffect(() => setCurrentUrl(window.location.href), []);
  const href = currentUrl ? staffRevisionReturnUrl(currentUrl, draft, process.env.NODE_ENV !== 'production', process.env.NEXT_PUBLIC_STAFF_PORTAL_ORIGIN) : null;
  return href ? <a href={href}>Review revision in portal ↗</a>
    : <Link href="/design-enquiry" prefetch={false}>Enquire about this design ↗</Link>;
}
