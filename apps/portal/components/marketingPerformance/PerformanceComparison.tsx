import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { comparisonRows, comparisonSorts, rate, type ComparisonSort, type MarketingRow } from '@/lib/marketingPerformance/contract';
import styles from './MarketingPerformance.module.css';

export default function PerformanceComparison({ rows, onInspect }: { rows: MarketingRow[]; onInspect: (source: string, campaign: string) => void }) {
  const [sort, setSort] = useState<ComparisonSort>(() => {
    const saved = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('sort');
    return comparisonSorts.includes(saved as ComparisonSort) ? saved as ComparisonSort : 'won';
  });
  const changeSort = (next: ComparisonSort) => {
    const url = new URL(window.location.href); url.searchParams.set('sort', next);
    window.history.replaceState(null, '', url); setSort(next);
  };
  return <Card title="Source & campaign progression" padding="none" footer="Enquiries and qualification count submissions; qualification covers configured residential enquiries only. Every later stage counts unique origin projects, credited to their earliest recorded enquiry.">
    <div className={styles.comparisonToolbar}><p className={styles.muted}>Compare outcomes and rates, then inspect the supporting records.</p>
      <Select label="Sort sources by" value={sort} onChange={event => changeSort(event.target.value as ComparisonSort)}>
        <option value="won">Most payment-verified projects</option><option value="qualified">Most qualified enquiries</option><option value="enquiries">Most enquiries</option><option value="winRate">Highest payment-verified rate</option>
      </Select></div>
    <div className={`${styles.tableScroll} ${styles.comparisonTable}`} tabIndex={0} role="region" aria-label="Source comparison, scroll horizontally for all stages">
      <Table><caption className={styles.caption}>Observed campaign evidence, separate from Google and Meta attribution claims</caption>
        <TableHeader><TableRow><TableHead scope="col">Source / campaign</TableHead><TableHead scope="col">Enquiries</TableHead><TableHead scope="col">Qualified</TableHead><TableHead scope="col">Origin projects</TableHead><TableHead scope="col">Visits</TableHead><TableHead scope="col">Quotes sent</TableHead><TableHead scope="col">Accepted</TableHead><TableHead scope="col">Payment verified</TableHead><TableHead scope="col">Evidence</TableHead></TableRow></TableHeader>
        <TableBody>{comparisonRows(rows, sort).map(group => <TableRow key={JSON.stringify([group.source, group.campaign])}>
          <TableHead scope="row" className={styles.source}><strong>{group.source}</strong><span>{group.campaign}</span></TableHead>
          <TableCell>{group.summary.enquiries}</TableCell><TableCell>{group.summary.eligible === group.summary.unreviewed ? "Unassessed" : group.summary.qualified}<span className={styles.cellDetail}>{group.summary.eligible - group.summary.unreviewed} assessed / {group.summary.eligible} eligible</span></TableCell><TableCell>{group.summary.origins}</TableCell><TableCell>{group.summary.visit}</TableCell><TableCell>{group.summary.quote}</TableCell><TableCell>{group.summary.accepted}</TableCell><TableCell>{group.summary.won}<span className={styles.cellDetail}>{rate(group.summary.won, group.summary.origins)} of origins</span></TableCell>
          <TableCell><Button variant="quiet" aria-label={`Inspect ${group.source} / ${group.campaign}`} onClick={() => onInspect(group.source, group.campaign)}>Inspect</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </Card>;
}
import { useState } from 'react';
