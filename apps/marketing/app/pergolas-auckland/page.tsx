import type { GuidedJourneySearchParams } from '@/lib/guidedJourneyContext';
import LegacyPergolasPage from './LegacyPergolasPage';
import PergolaLandingPage from './redesign/PergolaLandingPage';
import { pergolaComparisonEnabled } from './comparisonPreview.server';
import { PergolaStructuredData } from './landingSeo';

export { landingMetadata as metadata } from './landingSeo';

export default async function PergolasAucklandPage({ searchParams }: { searchParams?: Promise<GuidedJourneySearchParams> }) {
  const params = searchParams ? await searchParams : {};
  return <>
    <PergolaStructuredData />
    {pergolaComparisonEnabled()
      ? <LegacyPergolasPage searchParams={Promise.resolve(params)} />
      : <PergolaLandingPage sourcePath="/pergolas-auckland" searchParams={params} />}
  </>;
}
