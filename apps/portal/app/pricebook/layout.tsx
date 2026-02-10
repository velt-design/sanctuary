import { getPortalSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function PricebookLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect('/login?callbackUrl=/pricebook');

  if (session.role !== 'admin') redirect('/staff/calculator');

  return children;
}
