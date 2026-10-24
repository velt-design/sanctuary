import { requireStaffPageAccess } from '@/lib/auth';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import type { Metadata } from 'next';
import EmailPreviewWorkbenchPage from './EmailPreviewWorkbenchPage';

export const metadata: Metadata = {
  title: 'Enquiry email workbench | Sanctuary Staff Portal',
};

export default async function EmailPreviewsPage() {
  await requireStaffPageAccess('/staff/email-previews');
  return <PortalGuardedPage pathname="/staff/email-previews" completion={{}} publicFrame={false}><EmailPreviewWorkbenchPage /></PortalGuardedPage>;
}
