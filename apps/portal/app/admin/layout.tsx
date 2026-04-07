import { requireAdminPageAccess } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageAccess('/admin/costs/materials');

  return children;
}
