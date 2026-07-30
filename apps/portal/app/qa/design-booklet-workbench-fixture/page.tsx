import { notFound } from 'next/navigation';
import DesignBookletWorkbenchPage from '@/app/staff/design-booklets/DesignBookletWorkbenchPage';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function DesignBookletWorkbenchFixturePage() {
  if (!arePortalQaFixturesEnabled()) notFound();
  return (
    <DesignBookletWorkbenchPage
      pdfEndpoint="/api/qa/design-booklet-workbench/pdf"
      qaFixture
    />
  );
}
