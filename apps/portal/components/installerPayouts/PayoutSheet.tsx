import { payoutSummary, type PayoutEvent } from '@/lib/installerPayouts/model';
export const dollars = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value);
export function PayoutSheet({ events }: { events: PayoutEvent[] }) {
  const summary = payoutSummary(events);
  if (!summary) return <p>No installer agreement has been confirmed for this project.</p>;
  const a = summary.agreement;
  return <section aria-label="Confirmed payout sheet">
    <h2>Installer payout · {a.installer}</h2>
    <p><strong>Installation scope</strong><br />{a.scope}</p>
    <p><strong>Exclusions</strong><br />{a.exclusions}</p>
    <p><strong>Payment terms</strong><br />{a.paymentTerms}</p>
    <p>Installer acceptance: {a.acceptanceReference}</p>
    <p>Base agreement: {dollars(a.payoutExGst)} excluding GST + {dollars(a.gst)} GST = <strong>{dollars(a.totalPayable)}</strong></p>
    <p>{a.gstRegistered ? 'GST-registered installer.' : 'Installer is not GST registered; no GST added.'}</p>
    <h3>Agreed total including variations: {dollars(summary.expected)}</h3>
    <p>Invoices recorded: {dollars(summary.invoiced)} · {summary.hasInvoices ? summary.difference === 0 ? 'Matches the agreed total' : `${dollars(Math.abs(summary.difference))} ${summary.difference > 0 ? 'above' : 'below'} the agreed total` : 'Awaiting invoice'}</p>
    <p>Reconciliation only. Payment status is managed separately.</p>
    <h3>History</h3>
    <ol>{events.map(e => <li key={e.id}><strong>{e.kind}</strong> · {new Date(e.created_at).toLocaleString('en-NZ')}<br />
      {e.kind === 'agreement' ? 'Original agreement confirmed' : `${e.payload.reference}: ${e.payload.reason ?? e.payload.note} — ${dollars(Number(e.payload.totalPayable ?? e.payload.amount))}`}
    </li>)}</ol>
    <small>Accepted quote version: {a.sourceQuoteId}<br />Estimate: {a.sourceEstimateId}</small>
  </section>;
}
