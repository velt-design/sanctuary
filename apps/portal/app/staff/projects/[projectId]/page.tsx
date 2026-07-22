import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { DataStatePanel, PageLayout } from '@/components/ui/foundation';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import { isPortalPageDebugExportEnabled } from '@/lib/debug/portalPageDebugExport';
import { isProjectTabKey } from '@/lib/projects/projectTabs';

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
  params: PageParams | Promise<PageParams>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = parseTab(resolvedSearchParams?.tab);
  const estimateId = parseSingleSearchParam(resolvedSearchParams?.estimateId);
  if (!projectId.trim()) {
    return (
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
    );
  }

  return (
    <ProjectSnapshotPageClient
      projectId={projectId}
      tab={tab}
      estimateId={estimateId}
      debugExportEnabled={isPortalPageDebugExportEnabled()}
    />
  );
}
