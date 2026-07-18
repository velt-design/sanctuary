import type { Metadata } from 'next';
import './globals.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import type { CSSProperties } from 'react';
import { Providers } from './providers';
import { getPortalAccessState } from '@/lib/auth';
import { initialPortalAuthStateFromAccess } from '@/lib/portalAccess';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';
import PortalVitalsReporter from '@/components/performance/PortalVitalsReporter';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let cssVars: CSSProperties = {} as CSSProperties;
  const accessState = await getPortalAccessState();

  try {
    const theme = await loadPortalThemeForUser(accessState.kind === 'authenticated' ? accessState.session.user.id : null);
    cssVars = portalThemeStyleVars(theme) as CSSProperties;
  } catch {
    cssVars = {} as CSSProperties;
  }

  return (
    <html lang="en" style={cssVars}>
      <body>
        <PortalAuthProvider initialAuthState={initialPortalAuthStateFromAccess(accessState)}>
          <Providers>
            <PortalVitalsReporter />
            <ToastProvider>
              <PortalShell>{children}</PortalShell>
            </ToastProvider>
          </Providers>
        </PortalAuthProvider>
      </body>
    </html>
  );
}
