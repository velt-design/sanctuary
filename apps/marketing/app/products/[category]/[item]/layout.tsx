import type { Metadata } from 'next';
import { getProduct } from '@/data/products';

type LayoutParams = { category: string; item: string };

type LayoutProps = {
  params: Promise<LayoutParams>;
};

export async function generateMetadata(
  { params }: LayoutProps,
): Promise<Metadata> {
  const { category, item } = await params;
  const product = getProduct(category, item);

  if (!product) {
    return {
      title: 'Product not found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: product.metadata.title,
    description: product.metadata.description,
    alternates: { canonical: product.route },
    openGraph: {
      url: product.route,
      title: `${product.metadata.title} | Sanctuary Pergolas`,
      description: product.metadata.description,
      images: [{
        url: product.metadata.ogImage,
        width: 1200,
        height: 630,
        alt: product.hero.alt,
      }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.metadata.title} | Sanctuary Pergolas`,
      description: product.metadata.description,
      images: [product.metadata.ogImage],
    },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactNode;
}
