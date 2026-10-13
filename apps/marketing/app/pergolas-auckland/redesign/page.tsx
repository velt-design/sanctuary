import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { GuidedJourneySearchParams } from '@/lib/guidedJourneyContext';
import { LANDING_REDESIGN_PATH } from '@/components/configurator-prototype/draftScope';
import { pergolaComparisonEnabled } from '../comparisonPreview.server';
import PergolaLandingPage from './PergolaLandingPage';

export const metadata: Metadata = {
  title: { absolute: 'Pergolas Auckland | Sanctuary Design Preview' },
  alternates: { canonical: '/pergolas-auckland' },
  robots: { index: false, follow: false },
};

export default async function PergolaRedesignPage({ searchParams }: { searchParams?: Promise<GuidedJourneySearchParams> }) {
  const params = searchParams ? await searchParams : {};
  if (!pergolaComparisonEnabled()) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
    }
    redirect('/pergolas-auckland' + (query.size ? '?' + query.toString() : ''));
  }
  return <PergolaLandingPage sourcePath={LANDING_REDESIGN_PATH} comparison searchParams={params} />;
}
