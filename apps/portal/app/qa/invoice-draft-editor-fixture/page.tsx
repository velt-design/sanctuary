import { notFound } from 'next/navigation';
import InvoiceDraftEditorFixture from './InvoiceDraftEditorFixture';

export default function InvoiceDraftEditorFixturePage() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') notFound();
  return <InvoiceDraftEditorFixture />;
}
