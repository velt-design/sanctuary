import DbGate from '@/components/sync/DbGate';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';

export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SupabaseEnvHydrator />
      <DbGate />
      {children}
    </>
  );
}
