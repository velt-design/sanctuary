import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import { requireStaffPageAccess } from '@/lib/auth';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import {PageLayout} from '@/components/ui/foundation';
import ConfiguratorRevisionClient from '@/components/projects/ConfiguratorRevisionClient';

export default async function Page({params, searchParams}: {
  params: Promise<{projectId: string}>; searchParams: Promise<{sourceEstimateId?: string}>;
}) {
  const {projectId} = await params;
  const pathname = `/staff/projects/${encodeURIComponent(projectId)}/configurator-revision`;
  await requireStaffPageAccess(pathname);
  return <PortalGuardedPage pathname={pathname} completion={{}} publicFrame={false}><PageLayout><StaffPageHeader title="Revise configured design" />
    <ConfiguratorRevisionClient projectId={projectId} sourceEstimateId={(await searchParams).sourceEstimateId} />
  </PageLayout></PortalGuardedPage>;
}
