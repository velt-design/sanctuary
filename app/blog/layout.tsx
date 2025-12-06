import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Blog | Sanctuary Pergolas',
  description: 'Guides, product updates and project write-ups from Sanctuary Pergolas.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}

