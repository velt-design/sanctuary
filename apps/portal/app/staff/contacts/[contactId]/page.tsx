import { requireStaffPageAccess } from '@/lib/auth';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import ContactDetailClient from './ContactDetailClient';

export default async function ContactDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const pathname = `/staff/contacts/${encodeURIComponent(contactId)}`;
  await requireStaffPageAccess(pathname);
  return <PortalGuardedPage pathname={pathname} completion={{}} publicFrame={false}><ContactDetailClient contactId={contactId} /></PortalGuardedPage>;
}
