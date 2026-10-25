import { notFound } from 'next/navigation';
import ProjectReads from './ProjectReads';
import DesignBookletWorkbenchPage from '@/app/staff/design-booklets/DesignBookletWorkbenchPage';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default async function DesignBookletWorkbenchFixturePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const query = await searchParams;
  if (query?.progressive === '1') {
    const projectId = query.project === 'b' ? 'proj_progressive_b' : 'proj_progressive_a';
    return <ProjectReads projectId={projectId}><DesignBookletWorkbenchPage projectId={projectId} pdfEndpoint="/api/qa/design-booklet-workbench/pdf" qaFixture /></ProjectReads>;
  }
  return (
    <DesignBookletWorkbenchPage
      pdfEndpoint="/api/qa/design-booklet-workbench/pdf"
      qaFixture
    />
  );
}
