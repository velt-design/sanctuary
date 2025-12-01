import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Contact Sanctuary Pergolas | Request A Site Visit',
  description:
    'Request a measure, quote or design advice for a custom aluminium pergola. Share dimensions, style preferences and site details to plan your build.',
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
