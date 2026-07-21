import DbGate from '@/components/sync/DbGate';
import { requireStaffPageAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPageAccess('/staff');

  return (
    <>
      <DbGate />
      {children}
    </>
  );
}
