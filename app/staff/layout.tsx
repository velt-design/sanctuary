import DbGate from '@/components/sync/DbGate';
import StaffSWRProvider from '@/components/sync/StaffSWRProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';
import PortalHeaderWithSession from '@/components/layout/PortalHeaderWithSession';
import NextAuthSessionProvider from '@/components/auth/NextAuthSessionProvider';
import StaffCacheWarmup from '@/components/sync/StaffCacheWarmup';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ToastProvider>
        <PortalHeaderWithSession />
        <DbGate />
        <StaffSWRProvider>
          <StaffCacheWarmup />
          <SupabaseEnvHydrator />
          {children}
        </StaffSWRProvider>
      </ToastProvider>
    </NextAuthSessionProvider>
  );
}
