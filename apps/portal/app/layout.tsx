import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';
import '@/components/ui/foundation/foundation.tokens.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import type { CSSProperties } from 'react';
import { Providers } from './providers';
import { getPortalAccessState } from '@/lib/auth';
import { initialPortalAuthStateFromAccess } from '@/lib/portalAccess';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';
import PortalVitalsReporter from '@/components/performance/PortalVitalsReporter';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

const portalInter = localFont({
  src: [
    { path: '../assets/fonts/Inter-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/Inter-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../assets/fonts/Inter-SemiBold.ttf', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang="en" className={portalInter.variable} style={cssVars}>
      <body>
        <SupabaseEnvHydrator />
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
