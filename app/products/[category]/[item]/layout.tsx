import type { Metadata } from 'next';
import { sections } from '@/data/mega';
import { productContent } from '@/data/productContent';
import { productDescriptions } from '@/data/productDescriptions';
import { metaDesc, stripArrow, imageForSlug } from '@/lib/seo';

type LayoutParams = { category: string; item: string };

type LayoutProps = {
  params: Promise<LayoutParams>;
};

export async function generateMetadata(
  { params }: LayoutProps,
): Promise<Metadata> {
  const { category, item } = await params;
  const sec = sections.find((s) => s.heading.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-') === category);
  const entry = sec?.items.find((i) => (i.href.split('/').pop() || '') === item);
  const baseTitle = stripArrow(entry?.title || item);
  const title = sec?.heading === 'Screens & walls' && /gable/i.test(baseTitle)
    ? baseTitle
    : baseTitle;

  const content = productContent[item as keyof typeof productContent];
  const long = productDescriptions[item];
  const description = metaDesc(
    content?.overview || (long ? long.split(/\n+/)[0] : 'Product detail'),
    180,
  );

  const canonical = `/products/${category}/${item}`;
  const ogImage = imageForSlug(item);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title: `${title} – Sanctuary Pergolas`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${title}` }],
      // Next.js OpenGraph types follow a limited enum; 'product' is invalid.
      // Use the generic 'website' type to avoid runtime errors.
      type: 'website',
    },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactNode;
}
