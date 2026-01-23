import { authOptions } from '@/lib/auth';
import PortalHeader from '@/components/layout/PortalHeader';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/admin/costs/materials');

  const role = (session.user as any)?.role as string | undefined;
  if (role !== 'admin') redirect('/staff/calculator');

  const email = session.user?.email ?? '';

  return (
    <>
      <PortalHeader email={email} role="admin" />
      {children}
    </>
  );
}
