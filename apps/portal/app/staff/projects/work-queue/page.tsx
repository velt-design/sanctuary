import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import {PortalGuardedPage} from '@/components/page-state/PortalPageSource';
import WorkQueueClient from './WorkQueueClient';
import { requireStaffPageAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectWorkQueuePage() {
  const session = await requireStaffPageAccess('/staff/projects/work-queue');
  return <PortalGuardedPage pathname="/staff/projects/work-queue" completion={{}}>
    <GuardedGlobalPortalSearch/><WorkQueueClient canReviewInactiveEnquiries={session.role === 'admin'} /></PortalGuardedPage>;
}
