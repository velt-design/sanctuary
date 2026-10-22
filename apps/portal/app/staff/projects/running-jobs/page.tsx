import { requireStaffPageAccess } from '@/lib/auth';
import RunningJobsClient from './RunningJobsClient';

export default async function StaffProjectsRunningJobsPage() {
  await requireStaffPageAccess('/staff/projects/running-jobs');
  return <RunningJobsClient />;
}
