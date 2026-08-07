import type { Metadata } from 'next';
import { connection } from 'next/server';
import localFont from 'next/font/local';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';
import '@/components/ui/foundation/foundation.tokens.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import { Providers } from './providers';
import PortalVitalsReporter from '@/components/performance/PortalVitalsReporter';
import SupabaseEnvHydrator from '@/components/diagnostics/SupabaseEnvHydrator';
import { PortalRouteTransitionProvider } from '@/components/page-state/PortalRouteTransition';

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
  // PortalShell reads the request URL to choose the exact data-free route frame.
  // This opts out of build-time prerendering without waiting on auth or data.
  await connection();

  return (
    <html lang="en" className={portalInter.variable}>
      <body>
        <SupabaseEnvHydrator />
        <PortalAuthProvider>
          <Providers>
            <PortalVitalsReporter />
            <ToastProvider>
              <PortalRouteTransitionProvider>
                <PortalShell>{children}</PortalShell>
              </PortalRouteTransitionProvider>
            </ToastProvider>
          </Providers>
        </PortalAuthProvider>
      </body>
    </html>
  );
}
