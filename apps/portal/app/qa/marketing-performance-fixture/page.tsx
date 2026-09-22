import { notFound } from 'next/navigation';
import Fixture from './Fixture';
export default async function MarketingPerformanceFixture({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  return <Fixture representative={(await searchParams).representative==='1'} />;
}
