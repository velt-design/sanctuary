'use client';
import { useState } from 'react';
import FinanceSummaryClient from '../../staff/payments/summary/FinanceSummaryClient';
import type { FinanceSummary, FinanceSummaryPeriod } from '@/lib/xero/financeSummaryContract';

type Scenario = 'complete' | 'empty' | 'failure' | 'mismatch';
// Fixture-local transport only. No fetch, accounting commands or connection credentials.
export default function FinanceSummaryFixture({ initialPeriod }: { initialPeriod: FinanceSummaryPeriod }) {
  const [scenario, setScenario] = useState<Scenario>('complete');
  async function read(period: FinanceSummaryPeriod): Promise<FinanceSummary> {
    if (scenario === 'failure') throw new Error('Synthetic provider failure');
    return { period: scenario === 'mismatch' ? { from: '2000-01-01', to: '2000-01-01' } : period,
      startedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), complete: true,
      currencies: scenario === 'empty' ? [] : [{ currency: 'NZD',
        invoiced: { count: 3, excludingTaxCents: 1000000, taxCents: 150000, includingTaxCents: 1150000 },
        receipts: { count: 2, reconciledCents: 400000, unreconciledCents: 75000, unknownReconciliationCents: 0 },
        outstanding: { count: 4, amountDueCents: 900000 } }] };
  }
  return <>
    <label>Sample response <select value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
      <option value="complete">Complete example</option><option value="empty">No matching records</option>
      <option value="failure">Provider unavailable</option><option value="mismatch">Wrong period returned</option>
    </select></label>
    <p>Choose a response, then use the real date form below. Changing a sample response does not make a new read until you submit. All figures are invented.</p>
    <FinanceSummaryClient initialPeriod={initialPeriod} read={read} />
  </>;
}
