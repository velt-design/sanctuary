'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { money, type HubProject } from '@/lib/marketingPerformance/hub';
import type { CommercialMetric, Contribution } from '@/lib/marketingPerformance/commercial';
import styles from './CommercialOverview.module.css';

export default function CommercialRecords({ metric, rows, projects, synthetic, summary }: {
  metric: CommercialMetric; rows: Contribution[]; projects: Map<string, HubProject>; synthetic?: boolean; summary: string;
}) {
  const [page, setPage] = useState(0), timing = metric.endsWith('Days');
  const sorted = [...rows].sort((a, b) => b.at.localeCompare(a.at) || a.row.quoteId.localeCompare(b.row.quoteId));
  const date = (value: string | null) => value ? new Date(value).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
  const link = (id: string) => synthetic ? `/qa/marketing-performance-fixture/project?project=${id}&return=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.search)}` : `/staff/projects/proj_${id}?tab=quotes`;
  return <div className={styles.records}>
    <p>{summary} · {rows.length} contributing scopes{timing ? ` · ${rows.filter(r => r.days !== null).length} usable date pairs` : ''}</p>
    <p className={styles.note}>{timing ? 'Exact saved dates in New Zealand time. Missing or out-of-order pairs do not enter the median.' : 'Stored quote amounts in NZD including GST. Each commercial scope appears once; add-ons are labelled.'}</p>
    {!synthetic && <p className={styles.note}>Projects open in a new tab so this report stays in place.</p>}
    <div className={`${styles.table} ${timing ? styles.timingTable : styles.valueTable}`} tabIndex={0} role="region" aria-label="Contributing commercial records"><table><thead><tr><th>Project / quote</th>{timing && <><th>From (NZ)</th><th>To (NZ)</th></>}<th>{timing ? 'Elapsed days' : 'Amount incl. GST'}</th></tr></thead><tbody>
      {sorted.slice(page * 25, (page + 1) * 25).map(item => <tr key={item.row.quoteId}><th><a href={link(item.row.projectId)} target={synthetic ? undefined : '_blank'} rel={synthetic ? undefined : 'noopener noreferrer'} aria-label={synthetic ? undefined : `${projects.get(item.row.projectId)?.name ?? 'Open project'} (opens in a new tab; report stays open)`}>{projects.get(item.row.projectId)?.name ?? 'Open project'}</a><small>{item.row.quoteRef}{item.versionNumber ? ` · v${item.versionNumber}` : ''} · {item.row.scopeKind === 'add_on' ? 'Add-on scope' : 'Initial scope'}</small>{!timing && <small>{date(item.at)} NZ</small>}</th>{timing && <><td>{date(item.from)}</td><td>{date(item.at)}</td></>}<td>{timing ? item.days === null ? 'Unavailable — missing / out-of-order dates' : item.days.toFixed(1) : item.amountCents === null ? 'Unavailable' : money(item.amountCents)}</td></tr>)}
    </tbody></table>{!rows.length && <p>No recorded scopes contribute to this selection.</p>}</div>
    <div className={styles.pager}><Button variant="secondary" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page + 1} of {Math.max(1, Math.ceil(rows.length / 25))}</span><Button variant="secondary" disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage(p => p + 1)}>Next</Button></div>
  </div>;
}
