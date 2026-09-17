'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import { financeSummaryPeriod, financeSummaryResponse, type FinanceSummary, type FinanceSummaryPeriod } from '@/lib/xero/financeSummaryContract';
import FinanceSummaryView from './FinanceSummaryView';
import styles from './summary.module.css';

async function readSummary(period: FinanceSummaryPeriod): Promise<unknown> {
  const response = await fetch('/api/payments/xero/summary', { method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(period), signal: AbortSignal.timeout(95000) });
  if (!response.ok) throw new Error('unavailable');
  return response.json();
}

export default function FinanceSummaryClient({ initialPeriod, read = readSummary }: {
  initialPeriod: FinanceSummaryPeriod;
  read?: (period: FinanceSummaryPeriod) => Promise<unknown>;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setSummary(null); setError('');
    if (!financeSummaryPeriod.safeParse(period).success) { setError('Choose valid dates spanning at most 90 days.'); return; }
    lock.current = true; setBusy(true);
    try {
      const result = financeSummaryResponse.parse(await read(period));
      if (result.period.from !== period.from || result.period.to !== period.to) throw new Error('wrong period');
      setSummary(result);
    } catch { setError('A complete summary could not be verified. No totals are shown. Try again or choose a shorter period.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function change(key: 'from' | 'to', value: string) { setPeriod(previous => ({ ...previous, [key]: value })); setSummary(null); setError(''); }
  return <>
    <form onSubmit={submit} aria-label="Choose summary dates">
      <fieldset disabled={busy} className={styles.period}><legend>Invoice and payment dates</legend>
        <label>From<Input type="date" required value={period.from} onChange={event => change('from', event.target.value)} /></label>
        <label>To<Input type="date" required value={period.to} onChange={event => change('to', event.target.value)} /></label>
        <Button type="submit" disabled={busy}>{busy ? 'Reading Xero...' : 'Read Xero summary'}</Button>
      </fieldset>
    </form>
    <p>The initial period is the last seven completed Auckland calendar dates. Choose up to 90 days, ending today or earlier.</p>
    <p>This only reads Xero. It does not issue invoices, record payments, reconcile bank transactions or send emails.</p>
    <div role="status" aria-live="polite">{busy ? 'Reading all required pages. This can take up to 90 seconds.' : ''}</div>
    {error && <div role="alert"><DataStatePanel state="error" title="Summary unavailable" description={error} /></div>}
    {summary && <FinanceSummaryView summary={summary} />}
  </>;
}
