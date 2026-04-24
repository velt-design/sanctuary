import { requireStaffPageAccess } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPageAccess('/dashboard');
  return children;
}
