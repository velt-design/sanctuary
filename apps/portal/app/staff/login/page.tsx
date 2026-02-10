import { redirect } from 'next/navigation';
import { getPortalSession } from '@/lib/auth';
import LoginPage from '@/app/login/page';

export default async function StaffLoginPage() {
  const session = await getPortalSession();
  if (session) {
    redirect('/dashboard');
  }

  return <LoginPage />;
}
