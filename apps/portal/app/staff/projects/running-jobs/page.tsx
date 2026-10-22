import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import {PortalGuardedPage} from '@/components/page-state/PortalPageSource';
import { requireStaffPageAccess } from '@/lib/auth';
import RunningJobsClient from './RunningJobsClient';

export default async function StaffProjectsRunningJobsPage() {
  await requireStaffPageAccess('/staff/projects/running-jobs');
  return <PortalGuardedPage pathname="/staff/projects/running-jobs" completion={{}}>
    <GuardedGlobalPortalSearch/><RunningJobsClient /></PortalGuardedPage>;
}
