'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import DashboardView from '@/app/dashboard/DashboardView';
import ContactsIndexPendingFrame from './ContactsIndexPendingFrame';
import ProjectsIndexPendingFrame from './ProjectsIndexPendingFrame';
import type { PortalInstantRoute } from '@/lib/portalInstantRoutes';
import WorkQueuePendingFrame from '@/app/staff/projects/work-queue/WorkQueuePendingFrame';
import SchedulePendingFrame from '@/app/staff/schedule/SchedulePendingFrame';
import SiteVisitsPendingFrame from '@/app/staff/schedule/SiteVisitsPendingFrame';
import DesignPackagesPendingFrame from '@/app/staff/projects/design-packages/DesignPackagesPendingFrame';
import RunningJobsPendingFrame from '@/app/staff/projects/running-jobs/RunningJobsPendingFrame';
import ContactDetailPendingFrame from '@/app/staff/contacts/[contactId]/ContactDetailPendingFrame';
import ContactCreatePendingFrame from '@/app/staff/contacts/new/ContactCreatePendingFrame';
import ProjectPagePendingFrame from '@/components/projects/ProjectPage/ProjectPagePendingFrame';
import UIFoundationPendingFrame from '@/app/staff/ui-foundation/UIFoundationPendingFrame';
import EmailPreviewPendingFrame from '@/app/staff/email-previews/EmailPreviewPendingFrame';
import DesignBookletPendingFrame from '@/app/staff/design-booklets/DesignBookletPendingFrame';
import AccessPendingFrame from '@/app/admin/access/AccessPendingFrame';
import ImportsPendingFrame from '@/app/admin/imports/ImportsPendingFrame';
import CostingControlPendingFrame from '@/app/admin/costing/CostingControlPendingFrame';
import ProjectCreatePendingFrame from '@/app/staff/projects/new/ProjectCreatePendingFrame';
import CalculatorShellPendingFrame from '@/app/staff/calculator/CalculatorShellPendingFrame';
import DesignWorkbenchPendingFrame from './DesignWorkbenchPendingFrame';
import type { ProjectNavigationTabKey, ProjectTabKey } from '@/lib/projects/projectTabs';
import { PORTAL_POST_AUTH_SHELL_BUNDLE_MARKER } from '@/lib/performance/portalPostAuthShellBundle';

type OfflineScheduleView = 'board' | 'gantt' | 'site-visits';

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/(?:staff\/)?projects\/([^/]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function nestedProjectRouteId(
  pathname: string,
  segment: 'quotes' | 'estimate',
): string | null {
  const match = pathname.match(new RegExp(`/projects/[^/]+/${segment}/([^/]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function missingExactRouteFrame(route: never): never {
  throw new Error(`Missing exact pending frame for registered portal route: ${String(route)}`);
}

export type PortalExactRouteFrameProps = {
  offlineShellActive?: boolean;
  route: PortalInstantRoute;
  label?: string | null;
  targetHref?: string | null;
};

export default function PortalExactRouteFrame({
  offlineShellActive = false,
  route,
  targetHref,
}: PortalExactRouteFrameProps) {
  const currentPathname = usePathname();
  const currentSearchParams = useSearchParams();
  const target = useMemo(() => {
    if (!targetHref) return null;
    try {
      return new URL(targetHref, 'http://portal.local');
    } catch {
      return null;
    }
  }, [targetHref]);
  const pathname = target?.pathname ?? currentPathname ?? '';
  const searchParams = target?.searchParams ?? currentSearchParams;
  const [offlineProjectTab, setOfflineProjectTab] = useState<ProjectTabKey | null>(null);
  const [offlineScheduleView, setOfflineScheduleView] = useState<OfflineScheduleView | null>(null);
  const [offlineQuoteDetail, setOfflineQuoteDetail] = useState<boolean | null>(null);
  const [offlineQuotePreview, setOfflineQuotePreview] = useState<boolean | null>(null);
  const [offlineJobPackDetail, setOfflineJobPackDetail] = useState<boolean | null>(null);
  const [offlineCanonicalProjectMode, setOfflineCanonicalProjectMode] = useState(false);

  useEffect(() => {
    setOfflineProjectTab(null);
    setOfflineScheduleView(null);
    setOfflineQuoteDetail(null);
    setOfflineQuotePreview(null);
    setOfflineJobPackDetail(null);
    setOfflineCanonicalProjectMode(false);
  }, [route, targetHref]);

  const requestedScheduleView = (() => {
    const view = searchParams.get('view')?.trim().toLowerCase();
    if (view === 'gantt' || view === 'site-visits') return view;
    return 'board';
  })();
  const activeScheduleView = offlineScheduleView ?? requestedScheduleView;

  const selectOfflineScheduleView = (nextView: OfflineScheduleView) => {
    if (!offlineShellActive || nextView === activeScheduleView) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('view', nextView);
    window.history.pushState(
      {},
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    );
    setOfflineScheduleView(nextView);
  };

  const selectOfflineProjectTab = (nextTab: ProjectTabKey) => {
    if (!offlineShellActive) return;
    const nextUrl = new URL(target?.toString() ?? window.location.href, window.location.origin);
    nextUrl.searchParams.set('tab', nextTab);
    if (nextTab !== 'quotes') nextUrl.searchParams.delete('quotePreview');
    if (nextTab !== 'job-packs') nextUrl.searchParams.delete('sheet');
    nextUrl.searchParams.delete('mode');
    window.history.pushState(
      {},
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    );
    setOfflineProjectTab(nextTab);
    setOfflineQuoteDetail(false);
    setOfflineQuotePreview(false);
    setOfflineJobPackDetail(false);
  };

  const leaveOfflineQuoteDetail = () => {
    if (!offlineShellActive) return;
    const projectId = projectIdFromPathname(pathname);
    if (!projectId) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/staff/projects/${encodeURIComponent(projectId)}`;
    nextUrl.searchParams.set('tab', 'quotes');
    nextUrl.searchParams.delete('quoteId');
    nextUrl.searchParams.delete('quotePreview');
    window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
    setOfflineProjectTab('quotes');
    setOfflineQuoteDetail(false);
    setOfflineQuotePreview(false);
    setOfflineCanonicalProjectMode(true);
  };

  const selectOfflineQuotePreview = (preview: boolean) => {
    if (!offlineShellActive) return;
    const nextUrl = new URL(window.location.href);
    if (preview) nextUrl.searchParams.set('quotePreview', '1');
    else nextUrl.searchParams.delete('quotePreview');
    window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    setOfflineQuotePreview(preview);
  };

  const leaveOfflineJobPackDetail = () => {
    if (!offlineShellActive) return;
    const projectId = projectIdFromPathname(pathname);
    if (!projectId) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/staff/projects/${encodeURIComponent(projectId)}`;
    nextUrl.searchParams.set('tab', 'job-packs');
    nextUrl.searchParams.delete('estimateId');
    nextUrl.searchParams.delete('sheet');
    window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
    setOfflineProjectTab('job-packs');
    setOfflineJobPackDetail(false);
    setOfflineCanonicalProjectMode(true);
  };

  const handleOfflineProjectNavigation = offlineShellActive
    ? (nextTab: ProjectNavigationTabKey) => selectOfflineProjectTab(nextTab)
    : undefined;
  const handleOfflineCommercialNavigation = offlineShellActive
    ? (view: 'quotes' | 'invoices') => selectOfflineProjectTab(view)
    : undefined;
  const requestedProjectTab = offlineProjectTab ?? searchParams.get('tab');
  const quoteId = searchParams.get('quoteId')?.trim()
    || nestedProjectRouteId(pathname, 'quotes');
  const estimateId = searchParams.get('estimateId')?.trim()
    || nestedProjectRouteId(pathname, 'estimate');
  const quoteDetailRequested = offlineQuoteDetail ?? Boolean(quoteId);
  const quotePreviewRequested = offlineQuotePreview ?? (
    (quoteDetailRequested || route === 'quote-detail')
      && (searchParams.get('quotePreview') === '1' || /\/print\/?$/.test(pathname))
  );
  const jobPackDetailRequested = offlineJobPackDetail
    ?? (requestedProjectTab === 'job-packs' && Boolean(estimateId));
  const renderRoute: PortalInstantRoute = offlineCanonicalProjectMode
    ? 'project-detail'
    : route;

  let frame: ReactNode;
  switch (renderRoute) {
    case 'dashboard':
      frame = <DashboardView state="pending" />;
      break;
    case 'projects-index':
      frame = <ProjectsIndexPendingFrame searchParams={searchParams} />;
      break;
    case 'contacts-index':
      frame = <ContactsIndexPendingFrame query={searchParams.get('q')?.trim() ?? ''} />;
      break;
    case 'work-queue':
      frame = <WorkQueuePendingFrame />;
      break;
    case 'schedule':
      frame = activeScheduleView === 'site-visits'
        ? <SiteVisitsPendingFrame onViewSelect={offlineShellActive ? selectOfflineScheduleView : undefined} />
        : (
            <SchedulePendingFrame
              view={activeScheduleView}
              onViewSelect={offlineShellActive ? selectOfflineScheduleView : undefined}
            />
          );
      break;
    case 'design-list':
      frame = <DesignPackagesPendingFrame />;
      break;
    case 'running-jobs':
      frame = <RunningJobsPendingFrame />;
      break;
    case 'calculator':
      frame = <CalculatorShellPendingFrame />;
      break;
    case 'contact-detail':
      frame = <ContactDetailPendingFrame />;
      break;
    case 'contact-create':
      frame = <ContactCreatePendingFrame />;
      break;
    case 'project-create':
      frame = <ProjectCreatePendingFrame />;
      break;
    case 'project-detail':
      frame = (
        <ProjectPagePendingFrame
          projectId={projectIdFromPathname(pathname)}
          activeTab={requestedProjectTab}
          onTabSelect={handleOfflineProjectNavigation}
          onCommercialViewSelect={handleOfflineCommercialNavigation}
          quoteDetail={requestedProjectTab === 'quotes' && quoteDetailRequested}
          quotePreview={quotePreviewRequested}
          quoteId={quoteId}
          jobPackDetail={jobPackDetailRequested}
          jobPackSheet={searchParams.get('sheet')}
          jobPackEstimateId={estimateId}
          onQuoteDetailBack={quoteDetailRequested ? leaveOfflineQuoteDetail : undefined}
          onQuotePreviewSelect={quoteDetailRequested && offlineShellActive
            ? selectOfflineQuotePreview
            : undefined}
          onJobPackDetailBack={jobPackDetailRequested ? leaveOfflineJobPackDetail : undefined}
        />
      );
      break;
    case 'design-workbench':
      frame = <DesignWorkbenchPendingFrame projectId={projectIdFromPathname(pathname)} />;
      break;
    case 'quote-detail':
      frame = (
        <ProjectPagePendingFrame
          projectId={projectIdFromPathname(pathname)}
          activeTab="quotes"
          quoteDetail
          quotePreview={quotePreviewRequested}
          quoteId={quoteId}
          onQuoteDetailBack={offlineShellActive ? leaveOfflineQuoteDetail : undefined}
          onQuotePreviewSelect={offlineShellActive ? selectOfflineQuotePreview : undefined}
        />
      );
      break;
    case 'estimate-detail':
      frame = (
        <ProjectPagePendingFrame
          projectId={projectIdFromPathname(pathname)}
          activeTab="job-packs"
          jobPackDetail
          jobPackSheet={searchParams.get('sheet') ?? 'materials'}
          jobPackEstimateId={estimateId}
          onJobPackDetailBack={offlineShellActive ? leaveOfflineJobPackDetail : undefined}
        />
      );
      break;
    case 'ui-foundation':
      frame = <UIFoundationPendingFrame />;
      break;
    case 'email-previews':
      frame = <EmailPreviewPendingFrame />;
      break;
    case 'design-booklets':
      frame = <DesignBookletPendingFrame projectId={searchParams.get('projectId')?.trim() || null} />;
      break;
    case 'admin-access':
      frame = <AccessPendingFrame />;
      break;
    case 'admin-imports':
      frame = <ImportsPendingFrame />;
      break;
    case 'admin-costing':
      frame = <CostingControlPendingFrame />;
      break;
    default:
      frame = missingExactRouteFrame(renderRoute);
  }

  return (
    <div
      data-portal-post-auth-shell-bundle={PORTAL_POST_AUTH_SHELL_BUNDLE_MARKER}
      style={{ display: 'contents' }}
    >
      {frame}
    </div>
  );
}
