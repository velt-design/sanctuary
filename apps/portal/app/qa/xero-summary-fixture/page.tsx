import { notFound } from 'next/navigation';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import PageHeader from '@/components/layout/PageHeader';
import FinanceSummaryFixture from './FinanceSummaryFixture';
import { completedWeek } from '@/lib/xero/financeSummaryContract';

export default function XeroSummaryFixture() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') notFound();
  return <PageLayout><PageHeader variant="index" title="Xero summary - sample preview" description="Synthetic examples only. No real Xero data or live accounting actions." />
    <FinanceSummaryFixture initialPeriod={completedWeek()} />
  </PageLayout>;
}
