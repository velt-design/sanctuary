import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Pergolas, screens and lighting built for New Zealand homes. Explore pitched, gable, hip and box-perimeter designs plus slats, acrylic panels and lighting.',
  alternates: { canonical: '/products' },
  openGraph: {
    url: '/products',
    title: 'Products – Sanctuary Pergolas',
    description:
      'Explore pergola designs and options: pitched, gable, hip, box-perimeter; slat screens, acrylic panels, blinds, downlights and LED strip.',
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactNode;
}
