import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { PageLayout, Card } from '@/components/ui/foundation/FoundationSurfaces';
import { representativeFixture } from '../representativeFixture';
import { fixtureReport, historicalFixtureRows } from '../fixtures';
import { hubFixture } from '../hubFixtures';
export default async function FixtureProject({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  const params = await searchParams;
  const returnQuery = typeof params.return === 'string' && params.return.startsWith('?') ? params.return : '';
  const representative=new URLSearchParams(returnQuery).get('representative')==='1';
  const data=representative?representativeFixture:hubFixture;
  const row = (representative?data.enquiries.rows:[...fixtureReport.rows, ...historicalFixtureRows]).find(entry => entry.enquiryId === params.enquiry);
  const project=data.projects.find(p=>p.id===params.project);
  if (!row && !project) notFound();
  return <PageLayout><PageHeader title={row?.projectName ?? project?.name ?? 'Sample enquiry'} variant="detail" back={{ label: 'Marketing & Sales', href: `/qa/marketing-performance-fixture${returnQuery}` }} />
    <p>Synthetic evidence only · Fictional records and amounts. This read-only page demonstrates drill-down; it does not edit a real project.</p>
    <Card title="Underlying sample record"><p>Enquiry ID: {row?.enquiryId ?? 'No saved receipt'}</p><p>Project ID: {row?.projectId ?? project?.id}</p><p>Qualification: {row?.qualification ?? 'Unavailable'}</p>
      <p>Confirmed visit: {row?.visit ? 'Yes' : 'No evidence'}</p><p>Quote sent: {row?.quote ? 'Yes' : 'No evidence'}</p>
      <p>Current accepted quote: {row?.accepted ? 'Yes' : 'No evidence'}</p><p>Verified payment: {row?.won || project?.paymentVerified ? 'Yes' : 'No evidence'}</p>
      <p>Current stage: {project?.stage ?? 'Unavailable'} · {project?.state ?? 'Unavailable'}</p>
      <p>Observed source: {row?.source ?? project?.source ?? 'Unknown / unattributed'}</p><p>Saved receipts: {project?.receiptCount ?? 0}</p>
    </Card><Card title="Recorded sales activity"><ul>{data.events.filter(e=>e.projectId===project?.id).map(e=><li key={e.id}>{e.day} · {e.kind.replaceAll('_',' ')} · {e.status}{e.amountCents===null?'':` · ${(e.amountCents/100).toLocaleString('en-NZ',{style:'currency',currency:'NZD'})} NZD (invented)`}</li>)}</ul>
      {!data.events.some(e=>e.projectId===project?.id)&&<p>No dated sales evidence in this demo.</p>}
    </Card></PageLayout>;
}
