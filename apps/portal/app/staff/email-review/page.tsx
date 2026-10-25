import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import { requireStaffPageAccess } from '@/lib/auth';
import EmailReviewWorkspace from '@/components/emailReview/EmailReviewWorkspace';
export default async function EmailReviewPage() {
  await requireStaffPageAccess('/staff/email-review');
  return <PortalGuardedPage pathname="/staff/email-review" completion={{}} publicFrame={false}><EmailReviewWorkspace /></PortalGuardedPage>;
}
