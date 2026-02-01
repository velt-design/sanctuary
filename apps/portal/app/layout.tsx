import type { Metadata } from 'next';
import './globals.css';
import NextAuthSessionProvider from '@/components/auth/NextAuthSessionProvider';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import PortalShell from '@/components/layout/PortalShell';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Sanctuary Portal',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthSessionProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <PortalShell>{children}</PortalShell>
            </Suspense>
          </ToastProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
