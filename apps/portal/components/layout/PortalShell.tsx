'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { buildAccessStatusHref, buildLoginHref, currentRequestPathWithSearch, toAccessStatusQueryState } from '@/lib/portalAccess';
import PortalFrame, { usePortalFrameNavigation } from './PortalFrame';
import styles from './PortalShell.module.css';

function isFixtureWorkbenchRoutePath(
  pathname: string | null,
  searchParams: { get(name: string): string | null } | null,
): boolean {
  if (!pathname) return false;
  if (pathname === '/qa/design-workbench-fixture' || pathname.startsWith('/qa/design-workbench-fixture/')) {
    return true;
  }
  return pathname === '/staff/projects/fixture-roof/design-workbench' && Boolean(searchParams?.get('fixture')?.trim());
}

function isPortalQaFixtureRoutePath(
  pathname: string | null,
  searchParams: { get(name: string): string | null } | null,
): boolean {
  return (
    isFixtureWorkbenchRoutePath(pathname, searchParams) ||
    pathname === '/qa/projects-index-mutation-fixture' ||
    pathname === '/qa/project-command-centre-fixture' ||
    pathname === '/qa/commercial-workflow-fixture' ||
    pathname === '/qa/project-page-shell-fixture' ||
    pathname === '/qa/ui-foundation-fixture' ||
    pathname === '/qa/email-preview-workbench-fixture' ||
    pathname === '/qa/email-review-fixture' ||
    pathname === '/qa/installer-payout' ||
    pathname === '/qa/design-booklet-workbench-fixture' ||
    pathname === '/qa/invoice-draft-editor-fixture' ||
    pathname === '/qa/invoice-restore-fixture' ||
    pathname === '/qa/revised-quote-fixture' ||
    pathname === '/qa/finance-register' ||
    pathname === '/qa/project-work-queue-fixture' ||
    pathname === '/qa/schedule-ops-fixture' ||
    pathname === '/qa/schedule-progressive-fixture' ||
    pathname === '/qa/portal-progressive-fixture' ||
    pathname === '/qa/finance-payment-fixture' ||
    pathname === '/qa/xero-summary-fixture' ||
    pathname === '/qa/enquiry-qualification-fixture' ||
    pathname === '/qa/marketing-performance-fixture' ||
    pathname === '/qa/marketing-performance-fixture/project'
  );
}

function isPublicRoutePath(pathname: string | null, searchParams: { get(name: string): string | null } | null): boolean {
  return Boolean(
    pathname &&
      (pathname.startsWith('/login') ||
        pathname.startsWith('/access-status') ||
        isPortalQaFixtureRoutePath(pathname, searchParams)),
  );
}

function isAuthenticatedStandaloneRoutePath(pathname: string | null): boolean {
  return Boolean(
    pathname &&
      (pathname === '/staff/design-booklets' ||
        pathname.startsWith('/staff/design-booklets/')),
  );
}

export default function PortalShell({ children, financeUserId }: { children: React.ReactNode; financeUserId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, user, role } = usePortalSession();
  const navigation = usePortalFrameNavigation();
  const financeAccess = status === 'authenticated' && Boolean(financeUserId) && user?.id === financeUserId;
  const hasMountedRef = useRef(false);

  const isPublicRoute = isPublicRoutePath(pathname, searchParams);
  const callbackUrl = useMemo(() => {
    const url = new URL('http://portal.local');
    url.pathname = pathname || '/dashboard';
    const search = searchParams.toString();
    url.search = search ? `?${search}` : '';
    return currentRequestPathWithSearch(url);
  }, [pathname, searchParams]);
  const redirectHref = useMemo(() => {
    if (status === 'unauthenticated') return buildLoginHref(callbackUrl);
    if (status === 'no_access' || status === 'lookup_failed') {
      return buildAccessStatusHref({
        state: toAccessStatusQueryState(status),
        callbackUrl,
      });
    }
    return null;
  }, [callbackUrl, status]);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isPublicRoute || !redirectHref) return;
    router.replace(redirectHref);
  }, [isPublicRoute, redirectHref, router]);

  if (isPublicRoute) return <>{children}</>;

  if (status !== 'authenticated' || !role) {
    return <div className={styles.contentStandalone}>{children}</div>;
  }

  if (isAuthenticatedStandaloneRoutePath(pathname)) {
    return <div data-authenticated-standalone-shell>{children}</div>;
  }

  return <PortalFrame financeAccess={financeAccess} navigation={navigation}>{children}</PortalFrame>;
}
