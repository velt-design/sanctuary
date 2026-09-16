import StaffPageHeader from '@/components/layout/StaffPageHeader';
import {PageLayout} from '@/components/ui/foundation';
import ConfiguratorRevisionClient from '@/components/projects/ConfiguratorRevisionClient';

export default async function Page({params, searchParams}: {
  params: Promise<{projectId: string}>; searchParams: Promise<{sourceEstimateId?: string}>;
}) {
  const {projectId} = await params;
  return <PageLayout><StaffPageHeader title="Revise configured design" />
    <ConfiguratorRevisionClient projectId={projectId} sourceEstimateId={(await searchParams).sourceEstimateId} />
  </PageLayout>;
}
