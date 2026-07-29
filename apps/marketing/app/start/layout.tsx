import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Start Your Pergola Brief',
  description: 'Choose your project type, preferred roof and site details.',
  alternates: { canonical: '/start' },
  openGraph: {
    url: '/start',
    title: 'Start Your Pergola Brief – Sanctuary Pergolas',
    description: 'Choose your project type, preferred roof and site details.',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function StartLayout({ children }: { children: ReactNode }) {
  return children;
}
