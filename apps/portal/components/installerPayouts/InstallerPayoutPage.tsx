'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Input, Textarea } from '@/components/ui/foundation';
import type { PayoutEvent } from '@/lib/installerPayouts/model';
import { AgreementForm } from './AgreementForm';
import { PayoutSheet } from './PayoutSheet';
import styles from './InstallerPayoutPage.module.css';

export default function InstallerPayoutPage({ projectId, transport = fetch }: { projectId: string; transport?: typeof fetch }) {
  const url = `/api/staff/projects/${encodeURIComponent(projectId)}/installer-payout`;
  const [events, setEvents] = useState<PayoutEvent[]>([]), [canEdit, setCanEdit] = useState(false);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [action, setAction] = useState<'variation' | 'invoice'>('variation');
  const [reference, setReference] = useState(''), [reason, setReason] = useState(''), [amount, setAmount] = useState('');
  const [approved, setApproved] = useState(false);
  const intent = useRef<{ key: string; id: string } | null>(null);
  const load = useCallback(async () => {
    const response = await transport(url, { cache: 'no-store' }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load payout.');
    setEvents(data.events); setCanEdit(data.canEdit); setLoaded(true);
  }, [url, transport]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function request(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    const key = JSON.stringify(body);
    if (intent.current?.key !== key) intent.current = { key, id: crypto.randomUUID() };
    try {
      const response = await transport(`/api/admin/projects/${encodeURIComponent(projectId)}/installer-payout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, commandId: intent.current.id, expectedSequence: events.at(-1)?.sequence ?? 0 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save payout.');
      if (body.action !== 'preview') { await load(); intent.current = null; setReference(''); setReason(''); setAmount(''); setApproved(false); }
      return data;
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Reload before retrying.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <header className={styles.controls}><ButtonLink href={`/staff/projects/${encodeURIComponent(projectId)}`} variant="secondary">Back to project</ButtonLink><h1>Installer payout</h1>
      <Button variant="secondary" onClick={() => { setError(''); void load().catch(e => setError(e.message)); }} disabled={busy}>Reload</Button>
      {events.length > 0 && <Button onClick={() => window.print()}>Print payout sheet</Button>}
    </header>
    {error && <p role="alert" className={styles.controls}>{error}</p>}
    {!loaded && !error && <p>Loading payout…</p>}
    {loaded && <><p>Project reference: {projectId}</p><PayoutSheet events={events} /></>}
    {loaded && !canEdit && <p className={styles.controls}>An admin confirms agreements and records financial changes.</p>}
    <div className={styles.controls}>
      {loaded && canEdit && !events.length && <AgreementForm request={request} busy={busy} />}
      {canEdit && events.length > 0 && <section><h2>Add to this agreement</h2><fieldset disabled={busy}>
        <label>Entry type <select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="variation">Approved variation</option><option value="invoice">Installer invoice</option></select></label>
        <Input label={action === 'variation' ? 'Approval reference' : 'Invoice reference'} value={reference} onChange={e => setReference(e.target.value)} />
        <Input label={action === 'variation' ? 'Additional amount excluding GST (NZD)' : 'Invoice total including any GST (NZD)'} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
        <Textarea label="Scope / reason" value={reason} onChange={e => setReason(e.target.value)} />
        {action === 'variation' && <label><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> Installer and Sanctuary have agreed this addition</label>}
        <p>Entries are retained in the history. Check the amount and reference before recording. Reductions and invoice corrections need an admin review outside this first workflow.</p>
        <Button onClick={() => { void request({ action, reference, reason, approved, amount: amount === '' ? null : Number(amount) }); }}>Record {action}</Button>
      </fieldset></section>}
    </div>
  </main>;
}
