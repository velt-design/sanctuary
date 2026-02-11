import DbGate from '@/components/sync/DbGate';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';
import StaffCacheWarmup from '@/components/sync/StaffCacheWarmup';

export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SupabaseEnvHydrator />
      <DbGate />
      <StaffCacheWarmup />
      {children}
    </>
  );
}
