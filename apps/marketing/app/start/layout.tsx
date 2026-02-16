import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Start Your Pergola Project | Sanctuary Pergolas',
  description:
    'Use the guided start flow to choose style and materials, capture site details, and prepare your pergola brief.',
};

export default function StartLayout({ children }: { children: ReactNode }) {
  return children;
}
