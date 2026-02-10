import { getPortalSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect('/login?callbackUrl=/admin/costs/materials');

  if (session.role !== 'admin') redirect('/staff/calculator');

  return children;
}
