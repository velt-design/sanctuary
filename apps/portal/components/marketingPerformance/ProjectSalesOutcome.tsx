'use client';
import { useState } from 'react';
import { Button,Select } from '@/components/ui/foundation/FoundationControls';
import { salesOutcomeSchema,type SalesOutcome,type SalesOutcomeCommand } from '@/lib/marketingPerformance/salesOutcome';
import styles from './DesignerPerformance.module.css';

export class OutcomeError extends Error {constructor(public status:number){super(status===409?'The outcome changed. Reload it before saving.':'The outcome could not be confirmed.');}}
export type OutcomeClient={read:(projectId:string)=>Promise<SalesOutcome>;record:(projectId:string,command:SalesOutcomeCommand)=>Promise<SalesOutcome>};
async function request(projectId:string,command?:SalesOutcomeCommand){
  const response=await fetch(`/api/staff/v1/projects/${projectId}/sales-outcome`,{method:command?'PUT':'GET',cache:'no-store',
    ...(command?{headers:{'Content-Type':'application/json'},body:JSON.stringify(command)}:{})});
  if(!response.ok)throw new OutcomeError(response.status);
  const result=salesOutcomeSchema.parse((await response.json()).outcome);
  if(result.projectId!==projectId)throw new Error('Outcome identity mismatch');return result;
}
const liveClient:OutcomeClient={read:id=>request(id),record:(id,command)=>request(id,command)};
export default function ProjectSalesOutcome({value,onChange,client=liveClient,readOnly=false}:{value:SalesOutcome;onChange:(v:SalesOutcome)=>void;client?:OutcomeClient;readOnly?:boolean}){
  const [editing,setEditing]=useState(false),[key,setKey]=useState(value.outcome??''),[basis,setBasis]=useState('');
  const [busy,setBusy]=useState(false),[pending,setPending]=useState<SalesOutcomeCommand|null>(null),[conflict,setConflict]=useState(false),[error,setError]=useState('');
  const reload=async()=>{setBusy(true);try{const current=await client.read(value.projectId);onChange(current);setKey(current.outcome??'');setPending(null);setConflict(false);setError('Outcome reloaded. Check the outcome and reason before saving.');}catch{setError('Could not reload the current outcome. Try again.');}finally{setBusy(false);}};
  const save=async()=>{
    const command=pending??{commandId:crypto.randomUUID(),expectedRevision:value.revision,outcome:(key||null) as SalesOutcome['outcome'],basis:basis.trim()};
    setPending(command);setBusy(true);setError('');
    try{await client.record(value.projectId,command);
      // A replay returns its original receipt. Read current state before displaying credit.
      const current=await client.read(value.projectId);onChange(current);setKey(current.outcome??'');setPending(null);setEditing(false);setBasis('');
    }catch(e){if(e instanceof OutcomeError&&e.status===409){setConflict(true);setError('Someone changed this outcome. Reload the current value before saving.');}
      else if(e instanceof OutcomeError&&[400,403,404,415].includes(e.status)){setPending(null);setError(e.status===403?'Owner access is required to record a sales outcome.':'The outcome was not saved. Check the project and reason.');}
      else setError('The save result is uncertain. Retry the same request to reconcile it before editing.');
    }finally{setBusy(false);}
  };
  return <section className={styles.assignment} aria-label="Sales outcome"><p><strong>Sales outcome: {value.outcome==='cancelled'?'Cancelled':value.outcome==='refunded'?'Refunded':'No report-only exclusion'}</strong></p>
    {value.updatedAt&&<p className={styles.note}>Recorded {new Date(value.updatedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}</p>}
    {value.basis&&<p>Outcome reason: {value.basis}</p>}
    {!editing?<Button variant="quiet" disabled={readOnly} onClick={()=>{setKey(value.outcome??'');setEditing(true);setError('');}}>Record sales outcome{readOnly?' (fixture read only)':''}</Button>:<>
    <p className={styles.note}>Applies to the whole job. A partial scope refund or payment adjustment is not a whole-job refund. Owner-confirmed reporting only; payments and operational work stay unchanged. Clearing this cannot remove an independent cancellation.</p>
      <Select label="Sales outcome" value={key} disabled={busy||!!pending} onChange={e=>setKey(e.target.value)}><option value="">Clear report-only exclusion</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option></Select>
      <label>Reason for outcome<textarea maxLength={500} value={basis} disabled={busy||!!pending} onChange={e=>setBasis(e.target.value)} rows={2}/></label>
      <div className={styles.assignmentActions}><Button disabled={busy||conflict||(!pending&&basis.trim().length<3)} onClick={save}>{busy?'Saving…':pending?'Retry same save':'Save outcome'}</Button>{conflict?<Button variant="secondary" disabled={busy} onClick={reload}>Reload outcome</Button>:!pending&&<Button variant="quiet" disabled={busy} onClick={()=>setEditing(false)}>Cancel</Button>}</div>
    </>}{error&&<p role="alert">{error}</p>}</section>;
}
