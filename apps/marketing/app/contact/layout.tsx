import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Start Your Pergola Project',
  description:
    'Share your site, rough dimensions and project priorities with Sanctuary Pergolas to start a custom fixed-roof pergola enquiry.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: '/contact',
    title: 'Start Your Pergola Project | Sanctuary Pergolas',
    description:
      'Share your site, rough dimensions and project priorities with Sanctuary Pergolas to start a custom fixed-roof pergola enquiry.',
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
