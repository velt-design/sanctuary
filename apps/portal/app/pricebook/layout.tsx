import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export default async function PricebookLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/pricebook');

  const role = (session.user as any)?.role as string | undefined;
  if (role !== 'admin') redirect('/staff/calculator');

  return children;
}
