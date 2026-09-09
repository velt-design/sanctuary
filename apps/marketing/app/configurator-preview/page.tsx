import type { Metadata } from 'next';
import { MarketingPage } from '../../components/marketing-foundation';
import ConfiguratorPreviewShell from '../../components/configurator-prototype/ConfiguratorPreviewShell';

export const metadata: Metadata = {
  title: 'Your pergola — design preview | Sanctuary',
  robots: { index: false, follow: false },
};

export default function ConfiguratorPreviewPage() {
  return <MarketingPage><ConfiguratorPreviewShell /></MarketingPage>;
}
