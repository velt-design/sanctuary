import { requireStaffPageAccess } from '@/lib/auth';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import ContactCreateClient from './ContactCreateClient';

export default async function ContactCreatePage() {
  await requireStaffPageAccess('/staff/contacts/new');
  return <PortalGuardedPage pathname="/staff/contacts/new" completion={{}} publicFrame={false}><ContactCreateClient /></PortalGuardedPage>;
}
