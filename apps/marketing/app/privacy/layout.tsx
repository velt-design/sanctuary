import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Sanctuary Pergolas',
  description:
    'Learn how Sanctuary Pergolas collects, uses and protects enquiry information, including contact details, project notes and analytics data.',
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
