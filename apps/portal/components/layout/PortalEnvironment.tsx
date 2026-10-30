import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import type { CSSProperties } from 'react';
import { Providers } from '@/app/providers';
import { getPortalAccessState } from '@/lib/auth';
import { initialPortalAuthStateFromAccess } from '@/lib/portalAccess';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';
import PortalVitalsReporter from '@/components/performance/PortalVitalsReporter';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';

/** Existing normal Portal environment. Studio has a separate inert document;
 * every other route preserves this fresh server theme/session/provider tree. */
export default async function PortalEnvironment({ children, fontClass }: { children: React.ReactNode; fontClass:string }) {
  // Navigation is advisory; finance routes and commands recheck the current grant.
  const financeSession = await getPaymentPilotSession().catch(() => null);
  let cssVars: CSSProperties = {} as CSSProperties;
  const accessState = await getPortalAccessState();

  try {
    const theme = await loadPortalThemeForUser(accessState.kind === 'authenticated' ? accessState.session.user.id : null);
    cssVars = portalThemeStyleVars(theme) as CSSProperties;
  } catch {
    cssVars = {} as CSSProperties;
  }

  return (
    <html lang="en" className={fontClass} style={cssVars}>
      <body>
        <SupabaseEnvHydrator />
        <PortalAuthProvider initialAuthState={initialPortalAuthStateFromAccess(accessState)}>
          <Providers>
            <PortalVitalsReporter />
            <ToastProvider>
              <PortalShell financeUserId={financeSession?.user.id}>{children}</PortalShell>
            </ToastProvider>
          </Providers>
        </PortalAuthProvider>
      </body>
    </html>
  );
}
