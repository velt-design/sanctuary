import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pitched, Gable & Box Pergolas',
  description:
    'Find your Sanctuary pergola. Compare Pitched, Gable and Box rooflines, then personalise your size, roofing and sides. Explore built projects and integrated options.',
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
