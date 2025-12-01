import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Resources For Architects & Builders | Sanctuary Pergolas',
  description:
    'Download CAD blocks, specification clauses, install guides and maintenance sheets to document Sanctuary Pergolas in your projects.',
};

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return children;
}
