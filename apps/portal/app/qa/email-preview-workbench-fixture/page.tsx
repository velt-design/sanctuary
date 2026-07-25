import { notFound } from 'next/navigation';
import EmailPreviewWorkbenchPage from '@/app/staff/email-previews/EmailPreviewWorkbenchPage';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function EmailPreviewWorkbenchFixturePage() {
  if (!arePortalQaFixturesEnabled()) notFound();
  return (
    <EmailPreviewWorkbenchPage
      previewEndpoint="/api/qa/email-preview-workbench"
      qaFixture
    />
  );
}
