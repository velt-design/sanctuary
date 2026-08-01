import WorkQueueClient from './WorkQueueClient';
import { getPortalSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectWorkQueuePage() {
  const session = await getPortalSession();
  return <WorkQueueClient canReviewInactiveEnquiries={session?.role === 'admin'} />;
}
