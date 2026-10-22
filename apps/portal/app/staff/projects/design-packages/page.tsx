import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import {PortalGuardedPage} from '@/components/page-state/PortalPageSource';
import { requireStaffPageAccess } from '@/lib/auth';
import DesignPackagesClient from './DesignPackagesClient';

export default async function StaffProjectsDesignPackagesPage() {
  await requireStaffPageAccess('/staff/projects/design-packages');
  return <PortalGuardedPage pathname="/staff/projects/design-packages" completion={{}}>
    <GuardedGlobalPortalSearch/><DesignPackagesClient /></PortalGuardedPage>;
}
