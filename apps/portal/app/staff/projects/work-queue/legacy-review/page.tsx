import { requireAdminPageAccess } from '@/lib/auth';
import LegacyContactedReviewClient from './LegacyContactedReviewClient';

export const dynamic = 'force-dynamic';

export default async function LegacyContactedReviewPage() {
  await requireAdminPageAccess(
    '/staff/projects/work-queue/legacy-review',
    '/staff/projects/work-queue',
  );
  return <LegacyContactedReviewClient />;
}
