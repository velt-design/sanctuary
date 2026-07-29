import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Compare Pergola Roof Forms and Materials',
  description: 'Compare pitched, gable, hip and box-perimeter forms with the main roof materials.',
  alternates: { canonical: '/start/explore' },
  robots: {
    index: false,
    follow: true,
  },
};

export default function StartExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
