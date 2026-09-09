import type { Metadata } from 'next';
import { MarketingPage } from '../../components/marketing-foundation';
import ConfiguratorPrototype from '../../components/configurator-prototype/ConfiguratorPrototype';

export const metadata: Metadata = {
  title: 'Your pergola — design preview | Sanctuary',
  robots: { index: false, follow: false },
};

export default function ConfiguratorPreviewPage() {
  return <MarketingPage><ConfiguratorPrototype /></MarketingPage>;
}
