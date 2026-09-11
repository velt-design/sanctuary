'use client';

import { useRef, useState } from 'react';
import { PipelineModal } from '@/components/ui/PipelineModal';
import { AlertBanner, Button, Input, Textarea } from '@/components/ui/foundation';
import { apiJson } from '@/lib/repo/apiClient';
import type { InvoiceDraft } from '@/lib/invoices/draftTypes';
import styles from './InvoiceDraftEditor.module.css';

const money = (value: number) => `$${(value / 100).toFixed(2)}`;

export default function InvoiceDraftEditor({ initial, onClose, onSaved, onIssued }: {
  initial: InvoiceDraft; onClose: () => void; onSaved: (draft: InvoiceDraft) => void;
  onIssued: (message: string, sendError: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(initial.revision === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(false);
  const lock = useRef(false);
  const issueCommand = useRef<string | null>(null);
  const linked = Boolean(draft.quoteVersionId);
  const total = draft.content.items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0);
  const path = `/api/admin/projects/${encodeURIComponent(draft.projectId)}/invoice-drafts`;
  function edit(next: InvoiceDraft) { setDraft(next); setDirty(true); issueCommand.current = null; }
  async function command(action: 'save' | 'issue' | 'delete', send = false) {
    if (lock.current || issued) return;
    lock.current = true; setBusy(true); setError('');
    if (action === 'issue') issueCommand.current ??= crypto.randomUUID();
    try {
      const result = await apiJson<{ draft?: InvoiceDraft; issued?: boolean; invoiceRef?: string; sendError?: string | null }>(path, {
        method: 'POST', body: JSON.stringify({ action, invoiceId: draft.id, expectedRevision: draft.revision,
          quoteVersionId: draft.quoteVersionId, content: draft.content, options: draft.options, commandId: issueCommand.current, send }),
      });
      if (result.draft) { setDraft(result.draft); setDirty(false); onSaved(result.draft); }
      if (result.issued) {
        setIssued(true);
        await onIssued(`Invoice ${result.invoiceRef} issued.`, result.sendError ?? null);
        onClose();
      }
      if (action === 'delete') { await onIssued('Draft deleted.', null); onClose(); }
    } catch (error) { setError(error instanceof Error ? error.message : 'Invoice command failed'); }
    finally { lock.current = false; setBusy(false); }
  }
  function changeItem(index: number, patch: Partial<InvoiceDraft['content']['items'][number]>) {
    const items = draft.content.items.map((item, i) => i === index ? { ...item, ...patch } : item);
    if (!linked) items[index].lineTotalIncGstCents = Math.round(items[index].qty * items[index].unitPriceIncGstCents);
    edit({ ...draft, content: { ...draft.content, items } });
  }
  function moveItem(index: number, delta: number) {
    const items = [...draft.content.items];
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
    edit({ ...draft, content: { ...draft.content, items } });
  }
  return <PipelineModal open title={linked ? 'Quote-linked invoice draft' : 'Standalone invoice draft'}
    description="DRAFT — preview only. Save changes before issuing. Drafts have no payment link or balance impact."
    onOpenChange={(open) => { if (!open && !busy) onClose(); }}
    actions={<>
      <Button disabled={busy || issued || !dirty} onClick={() => void command('save')}>Save draft</Button>
      <Button disabled={busy || dirty || issued} onClick={() => void command('issue')}>Issue invoice</Button>
      <Button disabled={busy || dirty || issued || !draft.content.billingEmail.trim()} onClick={() => void command('issue', true)}>Issue and send</Button>
      <Button variant="tertiary" disabled={busy} onClick={onClose}>{dirty ? 'Discard unsaved changes' : 'Close'}</Button>
    </>}>
    <div className={styles.editor}>
      {draft.revision > 0 && !dirty ? <a href={`${path}/${encodeURIComponent(draft.id)}/pdf`} target="_blank" rel="noreferrer">Preview saved draft PDF</a> : null}
      {error ? <AlertBanner tone="error" title="Invoice action failed">{error}</AlertBanner> : null}
      {issued ? <AlertBanner tone="info" title="Invoice issued">Invoice issued. Refresh the project to view its latest status.</AlertBanner> : null}
      <fieldset disabled={busy || issued} className={styles.fields}>
        <Input label="Billing name" value={draft.content.billingName} onChange={(e) => edit({ ...draft, content: { ...draft.content, billingName: e.target.value } })} />
        <Input label="Billing email" type="email" value={draft.content.billingEmail} onChange={(e) => edit({ ...draft, content: { ...draft.content, billingEmail: e.target.value } })} />
        <Textarea label="Billing address" value={draft.content.billingAddress} onChange={(e) => edit({ ...draft, content: { ...draft.content, billingAddress: e.target.value } })} />
        <Input label="Payment description" value={draft.options.label} onChange={(e) => edit({ ...draft, options: { ...draft.options, label: e.target.value } })} />
        <Input label="Due date" type="date" value={draft.options.dueDate ?? ''} onChange={(e) => edit({ ...draft, options: { ...draft.options, dueDate: e.target.value } })} />
        <Input label="Reference" value={draft.options.reference ?? ''} onChange={(e) => edit({ ...draft, options: { ...draft.options, reference: e.target.value } })} />
        <h3>{linked ? 'Quoted scope — reference' : 'Itemised invoice'}</h3>
        {linked ? <p>Quantities, prices and the quoted scope total are fixed. This section is a reference, not the amount due.</p> : null}
        {draft.content.items.map((item, index) => <div className={styles.item} key={item.id}>
          <Textarea label={`Item ${index + 1} description`} value={item.description} onChange={(e) => changeItem(index, { description: e.target.value })} />
          <div className={styles.numbers}>
            <Input label="Quantity" type="number" min="0.001" step="any" readOnly={linked} value={item.qty} onChange={(e) => changeItem(index, { qty: Number(e.target.value) })} />
            <Input label="Unit price incl GST" type="number" min="0" step="0.01" readOnly={linked} value={item.unitPriceIncGstCents / 100} onChange={(e) => changeItem(index, { unitPriceIncGstCents: Math.round(Number(e.target.value) * 100) })} />
            <strong>Line total {money(item.lineTotalIncGstCents)}</strong>
          </div>
          {!linked ? <div className={styles.numbers}>
            <Button variant="tertiary" disabled={index === 0} onClick={() => moveItem(index, -1)}>Move up</Button>
            <Button variant="tertiary" disabled={index === draft.content.items.length - 1} onClick={() => moveItem(index, 1)}>Move down</Button>
            <Button variant="tertiary" onClick={() => edit({ ...draft, content: { ...draft.content, items: draft.content.items.filter((_, i) => i !== index) } })}>Remove item</Button>
          </div> : null}
        </div>)}
        {!linked ? <Button variant="secondary" onClick={() => edit({ ...draft, content: { ...draft.content, items: [...draft.content.items, { id: crypto.randomUUID(), description: '', qty: 1, unitPriceIncGstCents: 0, lineTotalIncGstCents: 0 }] } })}>Add item</Button> : null}
        <strong>{linked ? 'Quoted scope total' : 'Item total'}: {money(total)}</strong>
        <h3>This invoice — amount due</h3>
        {linked ? <>
          <p>{draft.options.mode === 'split' ? `Split into ${draft.options.splitCount} instalments at issue.` : draft.options.mode === 'next_stage' ? 'The unpaid amount of the selected payment stage is checked when issued.' : draft.options.mode === 'full_remaining' ? 'The remaining available quote balance is checked when issued.' : 'Custom payment amount.'}</p>
          <Input label="Custom payment amount incl GST" type="number" min="0.01" step="0.01" value={(draft.options.amountIncGstCents ?? draft.amountIncGstCents) / 100}
            onChange={(e) => edit({ ...draft, options: { ...draft.options, mode: 'custom', amountIncGstCents: Math.round(Number(e.target.value) * 100) } })} />
        </> : <strong>{money(total)} incl GST</strong>}
        <Textarea label="Invoice notes" value={draft.content.notes} onChange={(e) => edit({ ...draft, content: { ...draft.content, notes: e.target.value } })} />
      </fieldset>
      {draft.revision > 0 ? <Button variant="destructive" disabled={busy || issued} onClick={() => void command('delete')}>Delete draft</Button> : null}
    </div>
  </PipelineModal>;
}
