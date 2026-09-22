import { requireAdminPageAccess } from '@/lib/auth';
import PortalActionsClient from './PortalActionsClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortalActionsPage() {
  await requireAdminPageAccess('/admin/portal-actions');
  return <PortalActionsClient />;
}
