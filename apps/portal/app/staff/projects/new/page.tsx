import { requireStaffPageAccess } from '@/lib/auth';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import ProjectCreateClient from './ProjectCreateClient';

export default async function ProjectCreatePage() {
  await requireStaffPageAccess('/staff/projects/new');
  return <PortalGuardedPage pathname="/staff/projects/new" completion={{}} publicFrame={false}><ProjectCreateClient /></PortalGuardedPage>;
}
