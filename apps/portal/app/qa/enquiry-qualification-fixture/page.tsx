import { notFound } from 'next/navigation';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import PageHeader from '@/components/layout/PageHeader';
import QualificationFixture from './QualificationFixture';
export default function EnquiryQualificationFixturePage() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') notFound();
  return <PageLayout><PageHeader variant="index" title="Original enquiry — qualification preview" description="Synthetic customer and decisions. No real enquiry, database, email or project changes." />
    <QualificationFixture />
  </PageLayout>;
}
