import { payoutSummary, type PayoutEvent } from '@/lib/installerPayouts/model';
export const dollars = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value);
export function PayoutSheet({events,pending=false}:{events:PayoutEvent[]|null;pending?:boolean}){
  const summary=events?payoutSummary(events):null;
  if(events&&!summary)return <p>No installer agreement has been confirmed for this project.</p>;
  const a=summary?.agreement,unknown=pending?'Reading…':'Unavailable';
  return <section aria-label="Confirmed payout sheet">
    <h2>Installer payout · {a?.installer??unknown}</h2>
    <p><strong>Installation scope</strong><br />{a?.scope??unknown}</p>
    <p><strong>Exclusions</strong><br />{a?.exclusions??unknown}</p>
    <p><strong>Payment terms</strong><br />{a?.paymentTerms??unknown}</p>
    <p>Installer acceptance: {a?.acceptanceReference??unknown}</p>
    <p>Base agreement: {a?dollars(a.payoutExGst):unknown} excluding GST + {a?dollars(a.gst):unknown} GST = <strong>{a?dollars(a.totalPayable):unknown}</strong></p>
    <p>{!a?unknown:a.gstRegistered ? 'GST-registered installer.' : 'Installer is not GST registered; no GST added.'}</p>
    <h3>Agreed total including variations: {summary?dollars(summary.expected):unknown}</h3>
    <p>Invoices recorded: {summary?dollars(summary.invoiced):unknown} · {!summary?unknown:summary.hasInvoices ? summary.difference === 0 ? 'Matches the agreed total' : `${dollars(Math.abs(summary.difference))} ${summary.difference > 0 ? 'above' : 'below'} the agreed total` : 'Awaiting invoice'}</p>
    <p>Reconciliation only. Payment status is managed separately.</p>
    <h3>History</h3>
    <ol>{events?.map(e => <li key={e.id}><strong>{e.kind}</strong> · {new Date(e.created_at).toLocaleString('en-NZ')}<br />
      {e.kind === 'agreement' ? 'Original agreement confirmed' : `${e.payload.reference}: ${e.payload.reason ?? e.payload.note} — ${dollars(Number(e.payload.totalPayable ?? e.payload.amount))}`}
    </li>)}</ol>
    <small>Accepted quote version: {a?.sourceQuoteId??unknown}<br />Estimate: {a?.sourceEstimateId??unknown}</small>
  </section>;
}
