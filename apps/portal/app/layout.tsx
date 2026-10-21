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
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';
import { getDocumentRenderDiagnostics } from '@/lib/performance/documentRenderDiagnostics';

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
  const startedAt = performance.now();
  const diagnostics = await getDocumentRenderDiagnostics();
  try {
    // Navigation is advisory; finance routes and commands recheck the current grant.
    const financeSession = await getPaymentPilotSession().catch(() => null);
    let cssVars: CSSProperties = {} as CSSProperties;
    const accessState = await getPortalAccessState();

    try {
      const loadTheme = () => loadPortalThemeForUser(accessState.kind === 'authenticated' ? accessState.session.user.id : null, diagnostics);
      const theme = diagnostics ? await diagnostics.measure('theme.total', loadTheme) : await loadTheme();
      cssVars = portalThemeStyleVars(theme) as CSSProperties;
    } catch {
      diagnostics?.record('theme.fallback', performance.now(), 'error');
      cssVars = {} as CSSProperties;
    }

    diagnostics?.record('layout.complete', startedAt, accessState.kind);
    return (
      <html lang="en" className={portalInter.variable} style={cssVars}>
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
  } catch (error) { diagnostics?.record('layout.complete', startedAt, 'error'); throw error; }
}
