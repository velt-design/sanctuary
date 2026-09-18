import type { Metadata } from 'next';
import { getImageProps } from 'next/image';
import { MarketingPage } from '../../components/marketing-foundation';
import ConfiguratorPreviewShell from '../../components/configurator-prototype/ConfiguratorPreviewShell';

export const metadata: Metadata = {
  title: 'Your pergola | Design preview | Sanctuary',
  robots: { index: false, follow: false },
};

export default async function ConfiguratorPreviewPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const params = await searchParams;
  const { props: openingImage } = getImageProps({ src: '/images/configurator/shape-pitched-v1.webp', alt: '', fill: true, sizes: '(max-width: 720px) 100vw, 720px' });
  return <MarketingPage>
    {params.open === '1' && <link rel="preload" as="image" imageSrcSet={openingImage.srcSet} imageSizes={openingImage.sizes} media="(max-width: 720px)" fetchPriority="high" />}
    <ConfiguratorPreviewShell initiallyOpen={params.open === '1'} />
  </MarketingPage>;
}
