import type { Metadata } from 'next';
import './globals.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import { Suspense, type CSSProperties } from 'react';
import { Providers } from './providers';
import { getPortalSession } from '@/lib/auth';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let cssVars: CSSProperties = {} as CSSProperties;
  try {
    const session = await getPortalSession();
    const theme = await loadPortalThemeForUser(session?.user.id ?? null);
    cssVars = portalThemeStyleVars(theme) as CSSProperties;
  } catch {
    cssVars = {} as CSSProperties;
  }

  return (
    <html lang="en" style={cssVars}>
      <body>
        <Providers>
          <PortalAuthProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <PortalShell>{children}</PortalShell>
              </Suspense>
            </ToastProvider>
          </PortalAuthProvider>
        </Providers>
      </body>
    </html>
  );
}
