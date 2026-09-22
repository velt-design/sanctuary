import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, Card } from '@/components/ui/foundation/FoundationSurfaces';
import { AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import { fixtureReport, historicalFixtureRows } from '../fixtures';
export default async function FixtureProject({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  const params = await searchParams;
  const row = [...fixtureReport.rows, ...historicalFixtureRows].find(entry => entry.enquiryId === params.enquiry);
  if (!row) notFound();
  const returnQuery = typeof params.return === 'string' && params.return.startsWith('?') ? params.return : '';
  return <PageLayout><PageHeader title={row.projectName ?? 'Sample enquiry'} variant="detail" back={{ label: 'Marketing Performance', href: `/qa/marketing-performance-fixture${returnQuery}` }} />
    <AlertBanner title="Synthetic evidence only">This evidence page is not the real project workflow. Authenticated project navigation still requires separate verification.</AlertBanner>
    <Card title="Underlying sample record"><p>Enquiry ID: {row.enquiryId}</p><p>Project ID: {row.projectId}</p><p>Qualification: {row.qualification}</p>
      <p>Confirmed visit: {row.visit ? 'Yes' : 'No evidence'}</p><p>Quote sent: {row.quote ? 'Yes' : 'No evidence'}</p>
      <p>Current accepted quote: {row.accepted ? 'Yes' : 'No evidence'}</p><p>Verified payment: {row.won ? 'Yes' : 'No evidence'}</p>
    </Card></PageLayout>;
}
