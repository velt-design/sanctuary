import WorkQueueClient from './WorkQueueClient';
import { requireStaffPageAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectWorkQueuePage() {
  const session = await requireStaffPageAccess('/staff/projects/work-queue');
  return <WorkQueueClient canReviewInactiveEnquiries={session.role === 'admin'} />;
}
