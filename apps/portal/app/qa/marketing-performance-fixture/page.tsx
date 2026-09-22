import { notFound } from 'next/navigation';
import Fixture from './Fixture';
export default function MarketingPerformanceFixture() {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  return <Fixture />;
}
