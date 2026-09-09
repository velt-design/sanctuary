import type { Metadata } from 'next';
import { MarketingPage } from '../../components/marketing-foundation';
import ConfiguratorPreviewShell from '../../components/configurator-prototype/ConfiguratorPreviewShell';

export const metadata: Metadata = {
  title: 'Your pergola — design preview | Sanctuary',
  robots: { index: false, follow: false },
};

export default async function ConfiguratorPreviewPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const params = await searchParams;
  return <MarketingPage><ConfiguratorPreviewShell initiallyOpen={params.open === '1'} /></MarketingPage>;
}
