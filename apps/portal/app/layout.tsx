import type { Metadata } from 'next';
import './globals.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import { Suspense, type CSSProperties } from 'react';
import { Providers } from './providers';
import { BRAND_ACCENT_HEX, BRAND_ACCENT_RGB_CSV } from '@sp/theme';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

const brandCssVars = {
  '--sp-accent': BRAND_ACCENT_HEX,
  '--sp-accent-rgb': BRAND_ACCENT_RGB_CSV,
} as CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={brandCssVars}>
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
