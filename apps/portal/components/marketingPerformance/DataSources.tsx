'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { loadMetaEvidence, metaCoverage, type MetaEvidence, type MetaEvidenceLoader } from '@/lib/marketingPerformance/dataSources';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import styles from './MarketingPerformance.module.css';

const date = (value: string) => new Date(value).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' });
export default function DataSources({ hub, loader = loadMetaEvidence, synthetic = false }: { hub: HubReport; loader?: MetaEvidenceLoader; synthetic?: boolean }) {
  const [evidence, setEvidence] = useState<MetaEvidence | null>(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(true), [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const controller = new AbortController();
    setEvidence(null); setError(''); setBusy(true);
    loader(controller.signal).then(value => {
      if (value.status === 'available') metaCoverage(value);
      if (!controller.signal.aborted) setEvidence(value);
    }).catch(() => { if (!controller.signal.aborted) setError('The saved Meta report could not be verified. Retry or check the source connection.'); })
      .finally(() => { if (!controller.signal.aborted) { setBusy(false); setNow(new Date()); } });
    return () => controller.abort();
  }, [loader, revision]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const coverage = evidence?.status === 'available' ? metaCoverage(evidence, now) : null;
  const available = evidence?.status === 'available' && !coverage?.expired ? evidence : null;
  const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-NZ', { style: 'currency', currency: available?.report.currency ?? 'NZD' }).format(value);
  return <div className={styles.sourceStack}>
    {synthetic && <p className={styles.environmentLabel}>Demo · Fictional business and campaign figures</p>}
    <Card title="Business records" padding="compact">
      <p>{hub.projects.length.toLocaleString()} projects · {hub.enquiries.rows.length.toLocaleString()} submissions in selected dates.</p>
      <p className={styles.muted}>Read {date(hub.asOf)} NZ. Enquiry history begins {hub.earliestReceipt ? date(hub.earliestReceipt) : 'at an unknown date'}; earlier enquiries are unavailable. Later history may also be incomplete.</p>
    </Card>
    <Card title="Meta advertising" padding="compact">
      <div className={styles.sourceStatus} aria-live="polite" aria-busy={busy}>
        {busy ? <p role="status">Checking the saved source report…</p> : error ? <p role="alert">{error}</p>
          : coverage?.expired ? <p role="status">The saved report has expired. Check again for newer evidence.</p>
          : evidence?.status === 'missing' ? <p>No retained report is available. This does not mean zero spend.</p>
          : available && <>
            <p><strong>{available.report.period.start} – {available.report.period.end}</strong> · {available.report.currency} · {available.report.timezone}</p>
            <p>{available.report.campaigns.length} returned campaigns · {coverage!.spendReported} with spend · {money(coverage!.totalSpend)} reported spend</p>
            <p className={styles.muted}>{coverage!.stale ? 'Older evidence · ' : 'Saved evidence · '}Fetched {date(available.report.fetchedAt)} NZ. Retained until {date(available.expiresAt)} NZ.</p>
          </>}
      </div>
      <Button variant="secondary" disabled={busy} onClick={() => setRevision(n => n + 1)}>Check saved report</Button>
      <p className={styles.muted}>Reads Sanctuary’s existing report. Does not refresh Meta, import history or extend retention.</p>
      {available && <details><summary>Campaign figures & source limits</summary>
        <p>Account {available.accountId}. {available.report.attribution}. These dates are independent of the hub filters. Spend is not matched to enquiry cohorts; acquisition costs remain unavailable.</p>
        <div className={styles.sourceCampaigns}>{available.report.campaigns.map(c => <section key={c.id} data-campaign={c.id}>
          <h3>{c.name}</h3><p className={styles.muted}>{c.id} · {c.attribution ?? 'Attribution not reported'}</p>
          <dl><div><dt>Spend</dt><dd>{money(c.spend)}</dd></div><div><dt>Impressions</dt><dd>{c.impressions?.toLocaleString() ?? 'Not reported'}</dd></div><div><dt>Link clicks</dt><dd>{c.linkClicks?.toLocaleString() ?? 'Not reported'}</dd></div><div><dt>Meta website leads</dt><dd>{c.websiteLeads?.toLocaleString() ?? 'Not reported'}</dd></div></dl>
        </section>)}</div>
        <p className={styles.muted}>One seven-day report, up to 300 campaigns. The source withholds incomplete reads. Missing values stay unavailable. A saved report is not a historical spend ledger; campaign IDs are retained but no project matches are asserted.</p>
      </details>}
      {!busy && <a href="https://velt.systems/connections" target="_blank" rel="noreferrer">Source connection status</a>}
    </Card>
    <Card title="Sources not yet connected to this hub" padding="compact">
      <dl className={styles.sourceDefinitions}>
        <dt>GA4</dt><dd>Acquisition, landing pages and website events are available in the <a href="https://velt.systems/analytics" target="_blank" rel="noreferrer">existing analytics report</a>. Not yet connected here or matched to individual enquiries.</dd>
        <dt>Google Ads</dt><dd>No verified spend feed in this hub.</dd>
        <dt>Customer-reported discovery</dt><dd>No verified referral or discovery dataset. Unknown source stays unknown.</dd>
      </dl>
    </Card>
  </div>;
}
