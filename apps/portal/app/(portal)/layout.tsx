import type { CSSProperties } from 'react';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import PortalShell from '@/components/layout/PortalShell';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { getPortalAccessState } from '@/lib/auth';
import { initialPortalAuthStateFromAccess } from '@/lib/portalAccess';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';
import { Providers } from '../providers';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let cssVars: CSSProperties = {} as CSSProperties;
  const accessState = await getPortalAccessState();

  try {
    const theme = await loadPortalThemeForUser(accessState.kind === 'authenticated' ? accessState.session.user.id : null);
    cssVars = portalThemeStyleVars(theme) as CSSProperties;
  } catch {
    cssVars = {} as CSSProperties;
  }

  return (
    <div style={cssVars}>
      <Providers>
        <PortalAuthProvider initialAuthState={initialPortalAuthStateFromAccess(accessState)}>
          <ToastProvider>
            <PortalShell>{children}</PortalShell>
          </ToastProvider>
        </PortalAuthProvider>
      </Providers>
    </div>
  );
}
