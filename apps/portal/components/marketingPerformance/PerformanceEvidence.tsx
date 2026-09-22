'use client';
import { useEffect, useState } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { UNKNOWN_SOURCE, NO_CAMPAIGN, stages, stageLabels, type MarketingRow, type Stage } from '@/lib/marketingPerformance/contract';
import styles from './MarketingPerformance.module.css';

const qualificationNames: Record<MarketingRow['qualification'], string> = { qualified: 'Qualified', not_qualified: 'Not qualified', unreviewed: 'Unreviewed', ineligible: 'Outside configured criteria', unavailable: 'Unavailable' };
export default function PerformanceEvidence({ rows, synthetic }: { rows: MarketingRow[]; synthetic: boolean }) {
  const [evidence, setEvidence] = useState(() => {
    const saved = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('evidence');
    return saved && ['all','qualified','unreviewed','lost','no_quote','no_win',...stages].includes(saved) ? saved : 'all';
  });
  const [page, setPage] = useState(() => {
    const saved = typeof window === 'undefined' ? 0 : Number(new URLSearchParams(window.location.search).get('page'));
    return Number.isInteger(saved) && saved >= 0 && saved < Math.ceil(rows.length / 25) ? saved : 0;
  });
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const saved = params.get('evidence');
      setEvidence(saved && ['all','qualified','unreviewed','lost','no_quote','no_win',...stages].includes(saved) ? saved : 'all');
      const savedPage = Number(params.get('page'));
      setPage(Number.isInteger(savedPage) && savedPage >= 0 && savedPage < Math.ceil(rows.length / 25) ? savedPage : 0);
    };
    restore(); window.addEventListener('popstate', restore); window.addEventListener('pageshow', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('pageshow', restore); };
  }, [rows.length]);
  const saveSelection = (nextEvidence: string, nextPage: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('evidence', nextEvidence); url.searchParams.set('page', String(nextPage));
    window.history.replaceState(null, '', url); setEvidence(nextEvidence); setPage(nextPage);
  };
  const visible = rows.filter(row => evidence === 'all' || (evidence === 'qualified' || evidence === 'unreviewed' ? row.qualification === evidence
    : evidence === 'lost' ? row.origin && row.closedOutcome?.startsWith('LOST_')
      : evidence === 'no_quote' ? row.origin && !row.quote : evidence === 'no_win' ? row.origin && !row.won : row.origin && row[evidence as Stage]));
  return <Card title="Check the underlying records" padding="compact">
    <div className={styles.evidenceToolbar}><Select label="Evidence to inspect" value={evidence} onChange={event => saveSelection(event.target.value, 0)}>
      <option value="all">All enquiries</option><option value="qualified">Qualified enquiries</option><option value="unreviewed">Awaiting qualification review</option>
      {stages.map(stage => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
      <option value="lost">Recorded lost projects</option><option value="no_quote">No sent-quote evidence</option><option value="no_win">No verified win</option>
    </Select><span>{visible.length} matching records</span></div>
    <div className={`${styles.tableScroll} ${styles.evidenceTable}`} tabIndex={0} role="region" aria-label="Underlying enquiries, scroll horizontally for all evidence">
      <Table><TableHeader><TableRow><TableHead scope="col">Enquiry / project</TableHead><TableHead scope="col">Received (NZ)</TableHead><TableHead scope="col">Observed source</TableHead><TableHead scope="col">Qualification</TableHead><TableHead scope="col">Project evidence</TableHead></TableRow></TableHeader>
        <TableBody>{visible.slice(page * 25, (page + 1) * 25).map(row => <TableRow key={row.enquiryId}>
          <TableHead scope="row" className={styles.source}>{row.projectId ? <a href={synthetic
            ? `/qa/marketing-performance-fixture/project?enquiry=${row.enquiryId}&return=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.search)}`
            : `/staff/projects/proj_${row.projectId}?tab=activity`}>{row.projectName || 'Open project'}</a> : <span>No linked project</span>}
            <span>Enquiry {row.enquiryId}</span><span>{row.origin ? 'Origin enquiry' : row.projectId ? 'Repeat submission — no project credit' : 'Project outcomes unavailable'}</span></TableHead>
          <TableCell>{new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium' }).format(new Date(row.receivedAt))}</TableCell>
          <TableCell className={styles.source}>{row.source ?? UNKNOWN_SOURCE}<span>{row.campaign ?? NO_CAMPAIGN}</span></TableCell>
          <TableCell>{qualificationNames[row.qualification]}</TableCell>
          <TableCell>{row.origin ? <>{stages.filter(stage => row[stage]).map(stage => stageLabels[stage]).join(' · ') || 'No later evidence'}{row.closedOutcome && <span className={styles.outcome}>{row.closedOutcome.replaceAll('_', ' ').toLowerCase()}</span>}</> : row.projectId ? 'Counted on origin enquiry only' : 'No linked project evidence'}</TableCell>
        </TableRow>)}</TableBody></Table>
    </div>
    {!visible.length && <p>No records for this evidence selection.</p>}
    <div className={styles.pagination}><Button variant="secondary" disabled={page === 0} onClick={() => saveSelection(evidence, page - 1)}>Previous</Button>
      <span>Page {page + 1} of {Math.max(1, Math.ceil(visible.length / 25))}</span><Button variant="secondary" disabled={(page + 1) * 25 >= visible.length} onClick={() => saveSelection(evidence, page + 1)}>Next</Button></div>
    <p className={styles.muted}>Project links open Overview. Original enquiry in Project Work owns the submitted receipt; Commercial owns quotes and payment evidence. Use browser Back to return to your filters.</p>
  </Card>;
}
