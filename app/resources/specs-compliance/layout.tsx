import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pergola Specs & Compliance Notes | Sanctuary Pergolas',
  description:
    'Reference placeholder span tables, wind-zone callouts, drainage requirements and consent checklists before ordering engineered pergolas.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function SpecsComplianceLayout({ children }: { children: ReactNode }) {
  return children;
}
