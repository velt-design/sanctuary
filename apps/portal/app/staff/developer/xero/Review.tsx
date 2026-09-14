'use client';
import { useState, type FormEvent } from 'react';

type RecordRow = { id: string; reference: string; contact: string; status: string; date: string; total: number | null; paid: number | null; currency: string; reconciled: boolean | null };
export default function Review() {
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState('');
  const [records,setRecords] = useState<RecordRow[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage('Reading Xero…'); setRecords([]);
    try {
      const response = await fetch('/api/integrations/xero/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:form.get('kind'),value:form.get('value')})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Read failed');
      setRecords(result.records); setMessage(`${result.note} Checked ${result.checkedAt}.${result.limited ? ' First 20 records only; results may be incomplete.' : ''}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Read unavailable'); }
    finally { setPending(false); }
  }
  return <section><h2>Inspect candidate records</h2>
    <p>Search the exact invoice number, or the exact Xero contact name for money recorded directly as received. A matching amount or name alone is not proof of payment for a portal job.</p>
    <form onSubmit={submit}>
      <label>Record type <select name="kind"><option value="invoice">Invoice number</option><option value="receipt">Receipt contact name</option></select></label>{' '}
      <label>Search <input name="value" required minLength={1} maxLength={240} /></label>{' '}
      <button disabled={pending}>{pending ? 'Checking…' : 'Inspect'}</button>
    </form>
    <p role="status">{message}</p>
    {records.length > 0 && <table><thead><tr>{['Contact','Reference','Date','Status','Total','Paid','Reconciled'].map(title=><th key={title}>{title}</th>)}</tr></thead>
      <tbody>{records.map(row=><tr key={row.id}><td>{row.contact}</td><td>{row.reference}</td><td>{row.date}</td><td>{row.status}</td><td>{row.currency} {row.total}</td><td>{row.paid ?? '—'}</td><td>{row.reconciled === null ? '—' : row.reconciled ? 'Yes' : 'No'}</td></tr>)}</tbody></table>}
  </section>;
}
