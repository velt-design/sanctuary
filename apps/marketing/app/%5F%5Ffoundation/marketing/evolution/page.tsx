import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { shouldShowMarketingFoundation } from '../foundationAccess';
import Evolution from './Evolution';

export const metadata: Metadata = { title: 'Foundation studies', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function FoundationEvolutionPage() {
  if (!shouldShowMarketingFoundation({ nodeEnv: process.env.NODE_ENV, enabled: process.env.ENABLE_MARKETING_FOUNDATION })) notFound();
  return <Evolution />;
}
