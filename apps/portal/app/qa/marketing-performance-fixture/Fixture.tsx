'use client';
import MarketingPerformance, { type ReportLoader } from '@/components/marketingPerformance/MarketingPerformance';
import { aucklandDay } from '@/lib/marketingPerformance/contract';
import { fixtureFilters, fixtureReport, historicalFixtureRows } from './fixtures';

const loader: ReportLoader = async (filters, signal) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 450);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
  });
  if (new URLSearchParams(window.location.search).get('failure') === '1') throw new Error('Synthetic read failure. No customer system was contacted.');
  const query = new URLSearchParams(window.location.search);
  if (query.get('comparisonFailure') === '1' && filters.end < (query.get('start') ?? fixtureFilters.start)) throw new Error('Synthetic comparison failure');
  return { ...fixtureReport, start: filters.start, end: filters.end,
    rows: [...fixtureReport.rows, ...historicalFixtureRows].filter(row => { const day = aucklandDay(new Date(row.receivedAt)); return day >= filters.start && day <= filters.end; }) };
};
export default function Fixture() { return <MarketingPerformance loader={loader} synthetic initialFilters={fixtureFilters} />; }
