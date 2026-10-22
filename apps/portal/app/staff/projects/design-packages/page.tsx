import { requireStaffPageAccess } from '@/lib/auth';
import DesignPackagesClient from './DesignPackagesClient';

export default async function StaffProjectsDesignPackagesPage() {
  await requireStaffPageAccess('/staff/projects/design-packages');
  return <DesignPackagesClient />;
}
