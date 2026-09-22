'use client';
import MarketingPerformance from '@/components/marketingPerformance/MarketingPerformance';
import type { ReportLoader } from '@/components/marketingPerformance/useMarketingReports';
import type { HubLoader } from '@/components/marketingPerformance/useHub';
import { hubFixture } from './hubFixtures';
import { representativeFixture, representativeFilters } from './representativeFixture';
import { aucklandDay } from '@/lib/marketingPerformance/contract';
import { fixtureFilters, fixtureReport, historicalFixtureRows } from './fixtures';

const loader: ReportLoader = async (filters, signal) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 450);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
  });
  if (new URLSearchParams(window.location.search).get('failure') === '1') throw new Error('Synthetic read failure. No customer system was contacted.');
  const query = new URLSearchParams(window.location.search);
  const representative = query.get('representative') === '1';
  const report = representative ? representativeFixture.enquiries : fixtureReport;
  const rows = representative ? report.rows : [...fixtureReport.rows, ...historicalFixtureRows];
  if (query.get('comparisonFailure') === '1' && filters.end < (query.get('start') ?? fixtureFilters.start)) throw new Error('Synthetic comparison failure');
  return { ...report, start: filters.start, end: filters.end,
    rows: rows.filter(row => { const day = aucklandDay(new Date(row.receivedAt)); return day >= filters.start && day <= filters.end; }) };
};
const hubLoader:HubLoader=async(filters,signal)=>{
  const data=new URLSearchParams(window.location.search).get('representative')==='1'?representativeFixture:hubFixture;
  return {...data,start:filters.start,end:filters.end,enquiries:await loader(filters,signal),events:data.events.filter(e=>e.day>=filters.start&&e.day<=filters.end)};
};
export default function Fixture({representative=false}:{representative?:boolean}) { return <MarketingPerformance loader={hubLoader} priorLoader={loader} synthetic initialFilters={representative?representativeFilters:fixtureFilters}
  previewDescription={representative?'Representative demo · 1,200 fictional projects across active, archived and legacy work. Dates, sources and payment amounts are invented; missing-history patterns resemble the business. Demo ends 22 September 2026.':undefined} />; }
