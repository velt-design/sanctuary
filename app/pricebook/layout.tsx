import { authOptions } from '@/lib/auth';
import PortalHeader from '@/components/layout/PortalHeader';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export default async function PricebookLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/pricebook');

  const role = (session.user as any)?.role as string | undefined;
  if (role !== 'admin') redirect('/staff/calculator');

  const email = session.user?.email ?? '';

  return (
    <ToastProvider>
      <PortalHeader email={email} role="admin" />
      {children}
    </ToastProvider>
  );
}
