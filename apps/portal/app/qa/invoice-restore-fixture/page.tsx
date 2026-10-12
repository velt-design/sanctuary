import { notFound } from 'next/navigation';
import InvoiceRestoreFixture from './InvoiceRestoreFixture';
export default function Page() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== '1' || process.env.NODE_ENV !== 'development') notFound();
  return <InvoiceRestoreFixture />;
}
