import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pergola Forms, Screens, Lighting & Heating',
  description:
    'Compare four custom pergola forms plus screens, blinds, lighting and heating. See built Sanctuary projects, honest trade-offs and what your site needs to resolve.',
  alternates: { canonical: '/products' },
  openGraph: {
    url: '/products',
    title: 'Pergola Forms & Integrated Options | Sanctuary Pergolas',
    description:
      'Compare pergola forms, edge treatments, lighting and heating through real Sanctuary project evidence.',
    images: [{
      url: '/images/project-riverhead-gable-01.jpg',
      alt: 'Riverhead gable pavilion beside a pool and garden',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pergola Forms & Integrated Options | Sanctuary Pergolas',
    description:
      'Compare pergola forms, edge treatments, lighting and heating through real Sanctuary project evidence.',
    images: ['/images/project-riverhead-gable-01.jpg'],
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactNode;
}
