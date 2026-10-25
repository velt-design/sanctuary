'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Input, Textarea } from '@/components/ui/foundation';
import type { PayoutEvent } from '@/lib/installerPayouts/model';
import { AgreementForm } from './AgreementForm';
import { PayoutSheet } from './PayoutSheet';
import styles from './InstallerPayoutPage.module.css';

type Props={projectId:string;transport?:typeof fetch};
export default function InstallerPayoutPage(props:Props){return <InstallerPayoutContent key={props.projectId} {...props}/>;}
function InstallerPayoutContent({projectId,transport=fetch}:Props){
  const url = `/api/staff/projects/${encodeURIComponent(projectId)}/installer-payout`;
  const [events, setEvents] = useState<PayoutEvent[]>([]), [canEdit, setCanEdit] = useState(false),[knownCanEdit,setKnownCanEdit]=useState(false);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [action, setAction] = useState<'variation' | 'invoice'>('variation');
  const [reference, setReference] = useState(''), [reason, setReason] = useState(''), [amount, setAmount] = useState('');
  const [approved, setApproved] = useState(false);
  const [reading,setReading]=useState(true);
  const readController=useRef<AbortController|null>(null),generation=useRef(0);
  const intent = useRef<{ key: string; id: string } | null>(null);
  const load=useCallback(async()=>{
    readController.current?.abort();const controller=new AbortController(),ticket=++generation.current;readController.current=controller;
    setReading(true);setCanEdit(false);setError('');
    try{
      const response=await transport(url,{cache:'no-store',signal:controller.signal}),data=await response.json();
      if(controller.signal.aborted||ticket!==generation.current)return;
      if(!response.ok){if([401,403,404].includes(response.status)){setEvents([]);setLoaded(false);setKnownCanEdit(false);}throw new Error(data.error||'Could not load payout.');}
      setEvents(data.events);setCanEdit(data.canEdit);setKnownCanEdit(data.canEdit);setLoaded(true);
    }catch(error){if(controller.signal.aborted||ticket!==generation.current)return;setError(error instanceof Error?error.message:'Could not load payout.');throw error;}
    finally{if(!controller.signal.aborted&&ticket===generation.current)setReading(false);}
  },[url,transport]);
  useEffect(()=>{void load().catch(()=>{});return()=>readController.current?.abort();},[load]);
  async function request(body: Record<string, unknown>) {
    if(busy||reading||!loaded||!canEdit)return;
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
      <Button variant="secondary" onClick={()=>void load().catch(()=>{})} disabled={busy||reading}>Reload</Button>
      {events.length>0&&<Button disabled={reading||Boolean(error)} onClick={() => window.print()}>Print payout sheet</Button>}
    </header>
    {error && <p role="alert" className={styles.controls}>{error}</p>}
    {reading&&<p role="status">{loaded?'Updating payout; earlier verified sheet remains below.':'Reading verified payout agreement…'}</p>}
    <p>Project reference: {projectId}</p><PayoutSheet events={loaded?events:null} pending={reading}/>
    {loaded&&!reading&&!error&&!canEdit&& <p className={styles.controls}>An admin confirms agreements and records financial changes.</p>}
    <div className={styles.controls}>
      {loaded&&knownCanEdit&&!events.length && <AgreementForm request={request} busy={busy||reading||!canEdit} />}
      {knownCanEdit&&events.length>0 && <section><h2>Add to this agreement</h2><fieldset disabled={busy||reading||!canEdit}>
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
