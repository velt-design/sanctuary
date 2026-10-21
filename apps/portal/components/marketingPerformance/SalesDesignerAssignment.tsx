'use client';
import { useState } from 'react';
import { Button,Select } from '@/components/ui/foundation/FoundationControls';
import { PROJECT_OWNER_OPTIONS,projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import { salesDesignerSchema,type SalesDesigner,type SalesDesignerCommand } from '@/lib/marketingPerformance/salesDesigner';
import styles from './DesignerPerformance.module.css';

export class AssignmentError extends Error {constructor(public status:number){super(status===409?'The assignment changed. Reload it before saving.':'The assignment could not be confirmed.');}}
export type AssignmentClient={read:(projectId:string)=>Promise<SalesDesigner>;assign:(projectId:string,command:SalesDesignerCommand)=>Promise<SalesDesigner>};
async function request(projectId:string,command?:SalesDesignerCommand){
  const response=await fetch(`/api/staff/v1/projects/${projectId}/sales-designer`,{method:command?'PUT':'GET',cache:'no-store',
    ...(command?{headers:{'Content-Type':'application/json'},body:JSON.stringify(command)}:{})});
  if(!response.ok)throw new AssignmentError(response.status);
  const result=salesDesignerSchema.parse((await response.json()).assignment);
  if(result.projectId!==projectId)throw new Error('Assignment identity mismatch');return result;
}
const liveClient:AssignmentClient={read:id=>request(id),assign:(id,command)=>request(id,command)};
export default function SalesDesignerAssignment({value,onChange,client=liveClient,readOnly=false}:{value:SalesDesigner;onChange:(v:SalesDesigner)=>void;client?:AssignmentClient;readOnly?:boolean}){
  const [editing,setEditing]=useState(false),[key,setKey]=useState(value.designerKey??''),[basis,setBasis]=useState('');
  const [busy,setBusy]=useState(false),[pending,setPending]=useState<SalesDesignerCommand|null>(null),[conflict,setConflict]=useState(false),[error,setError]=useState('');
  const reload=async()=>{setBusy(true);try{const current=await client.read(value.projectId);onChange(current);setKey(current.designerKey??'');setPending(null);setConflict(false);setError('Assignment reloaded. Check the designer and reason before saving.');}catch{setError('Could not reload the current assignment. Try again.');}finally{setBusy(false);}};
  const save=async()=>{
    const command=pending??{commandId:crypto.randomUUID(),expectedRevision:value.revision,designerKey:(key||null) as SalesDesigner['designerKey'],basis:basis.trim()};
    setPending(command);setBusy(true);setError('');
    try{await client.assign(value.projectId,command);
      // A replay returns its original receipt. Read current state before displaying credit.
      const current=await client.read(value.projectId);onChange(current);setKey(current.designerKey??'');setPending(null);setEditing(false);setBasis('');
    }catch(e){if(e instanceof AssignmentError&&e.status===409){setConflict(true);setError('Someone changed this assignment. Reload the current value before saving.');}
      else if(e instanceof AssignmentError&&[400,403,404,415].includes(e.status)){setPending(null);setError(e.status===403?'Owner access is required to assign a sales designer.':'The assignment was not saved. Check the project and reason.');}
      else setError('The save result is uncertain. Retry the same request to reconcile it before editing.');
    }finally{setBusy(false);}
  };
  return <section className={styles.assignment} aria-label="Sales designer assignment"><p><strong>Sales designer: {projectOwnerOption(value.designerKey??'')?.displayName??'Unassigned'}</strong></p>
    <p className={styles.note}>Sales credit for this project. Actual visit attendance stays unchanged.{value.updatedAt?` Updated ${new Date(value.updatedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}.`:''}</p>
    {value.basis&&<p>Assignment reason: {value.basis}</p>}
    {!editing?<Button variant="quiet" disabled={readOnly} onClick={()=>{setKey(value.designerKey??'');setEditing(true);setError('');}}>Assign sales designer{readOnly?' (fixture read only)':''}</Button>:<>
      <Select label="Sales designer" value={key} disabled={busy||!!pending} onChange={e=>setKey(e.target.value)}><option value="">Unassigned</option>{PROJECT_OWNER_OPTIONS.map(p=><option key={p.key} value={p.key}>{p.displayName}</option>)}</Select>
      <label>Reason for assignment<textarea maxLength={500} value={basis} disabled={busy||!!pending} onChange={e=>setBasis(e.target.value)} rows={2}/></label>
      <div className={styles.assignmentActions}><Button disabled={busy||conflict||(!pending&&basis.trim().length<3)} onClick={save}>{busy?'Saving…':pending?'Retry same save':'Save assignment'}</Button>{conflict?<Button variant="secondary" disabled={busy} onClick={reload}>Reload assignment</Button>:!pending&&<Button variant="quiet" disabled={busy} onClick={()=>setEditing(false)}>Cancel</Button>}</div>
    </>}{error&&<p role="alert">{error}</p>}</section>;
}
