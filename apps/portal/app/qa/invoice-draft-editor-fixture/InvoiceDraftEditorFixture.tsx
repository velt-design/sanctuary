'use client';
import { useState } from 'react';
import InvoiceDraftEditor from '@/components/projects/ProjectPage/tabs/InvoiceDraftEditor';
import type { InvoiceDraft } from '@/lib/invoices/draftTypes';

const draft: InvoiceDraft = { id: 'inv_40000000-0000-4000-8000-000000000001', projectId: 'proj_10000000-0000-4000-8000-000000000001',
  quoteVersionId: 'qv_30000000-0000-4000-8000-000000000001', revision: 1, scopeTotalIncGstCents: 115000, amountIncGstCents: 57500,
  options: { mode: 'custom', label: 'Initial payment', amountIncGstCents: 57500, dueDate: '2026-09-30' },
  content: { version: 1, billingName: 'Synthetic customer', billingEmail: 'customer@example.invalid', billingAddress: '18 Example Lane\nAuckland',
    notes: 'Synthetic fixture only. Do not send or pay.', items: [{ id: 'line-1', description: 'Pergola structure\nPowder coated frame, posts and roof.', qty: 2, unitPriceIncGstCents: 57500, lineTotalIncGstCents: 115000 }] } };

export default function InvoiceDraftEditorFixture() {
  const [selected, setSelected] = useState<InvoiceDraft | null>(null);
  const [message, setMessage] = useState('');
  return <main style={{ padding: 24 }}>
    <h1>Invoice draft fixture</h1><p>Data-free visual fixture. Browser tests intercept every invoice command.</p>
    <button onClick={() => setSelected(draft)}>Open quote-linked draft</button>
    <button onClick={() => setSelected({ ...draft, quoteVersionId: null })}>Open standalone draft</button>
    <p role="status">{message}</p>
    {selected ? <InvoiceDraftEditor initial={selected} onClose={() => setSelected(null)} onSaved={() => setMessage('Draft saved')}
      onIssued={async (result, error) => setMessage(result + (error ? ' Sending failed: ' + error : ''))} /> : null}
  </main>;
}
