import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { DataStatePanel, PageLayout } from '@/components/ui/foundation';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import { isPortalPageDebugExportEnabled } from '@/lib/debug/portalPageDebugExport';
import { isProjectTabKey } from '@/lib/projects/projectTabs';
import { ProjectCorrespondenceWarmRead } from '@/components/projects/ProjectPage/tabs/overview/ProjectCorrespondenceWarmRead';
import { requireStaffPageAccess } from '@/lib/auth';
import { headers } from 'next/headers';
import { DOCUMENT_CALLBACK_HEADER, regionalDocumentCallback } from '@/lib/regionalDocumentAccess';
import { loadProjectWorkInitialRead } from './loadProjectWorkInitialRead';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';

function parseTab(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (isProjectTabKey(raw)) return raw;
  return 'activity';
}

type SearchParams = { [key: string]: string | string[] | undefined };
type PageParams = { projectId: string };

function parseSingleSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw : null;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const session = await requireStaffPageAccess(`/staff/projects/${encodeURIComponent(projectId)}`);
  const resolvedSearchParams = await searchParams;
  const tab = parseTab(resolvedSearchParams?.tab);
  const estimateId = parseSingleSearchParam(resolvedSearchParams?.estimateId);
  const fromEstimateId = parseSingleSearchParam(resolvedSearchParams?.fromEstimateId);
  const newDesign = parseSingleSearchParam(resolvedSearchParams?.newDesign) === '1';
  const calculatorWorkspace = tab === 'estimates' && Boolean(estimateId || fromEstimateId || newDesign);
  if (!projectId.trim()) {
    return (
      <PortalGuardedPage pathname={`/staff/projects/${encodeURIComponent(projectId)}`} completion={{}} publicFrame={false}>
      <PageLayout width="full" data-ui-foundation-consumer="project-detail">
        <StaffPageHeader
          variant="detail"
          eyebrow="Projects"
          title="Project unavailable"
          description="Invalid project id."
          back={{ label: 'Back to Projects', href: '/staff/projects' }}
        />
        <DataStatePanel
          state="unavailable"
          title="Project unavailable"
          description="The project link is invalid. Return to Projects and choose a record."
        />
      </PageLayout>
      </PortalGuardedPage>
    );
  }

  const requestHeaders = await headers();
  const callback = regionalDocumentCallback(requestHeaders.get(DOCUMENT_CALLBACK_HEADER));
  // Scheduling context only; ordinary RSC returns and prefetches retain the API path.
  const initialRead = tab === 'activity' && callback?.split('?')[0] === `/staff/projects/${encodeURIComponent(projectId)}`
    ? loadProjectWorkInitialRead(projectId, { userId: session.user.id, isAdmin: session.role === 'admin' })
    : undefined;
  return (
    <PortalGuardedPage pathname={`/staff/projects/${encodeURIComponent(projectId)}`} completion={{}} publicFrame={false}>
    <ProjectCorrespondenceWarmRead projectId={projectId} enabled={tab === 'activity'}>
    <ProjectSnapshotPageClient
      projectId={projectId}
      tab={tab}
      estimateId={estimateId}
      calculatorWorkspace={calculatorWorkspace}
      debugExportEnabled={isPortalPageDebugExportEnabled()}
      initialRead={initialRead}
    />
    </ProjectCorrespondenceWarmRead>
    </PortalGuardedPage>
  );
}
