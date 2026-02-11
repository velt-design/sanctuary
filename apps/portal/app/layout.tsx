import type { Metadata } from 'next';
import './globals.css';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import { Suspense } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
