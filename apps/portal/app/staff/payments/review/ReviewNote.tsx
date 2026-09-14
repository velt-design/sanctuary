'use client';
import { useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import type { PilotReviewNote } from '@/lib/xero/pilotTypes';

export default function ReviewNote({receiptId,notes,pending,onSave}:{receiptId:string;notes:PilotReviewNote[];pending:boolean;onSave:(id:string,disposition:PilotReviewNote['disposition'],reason:string)=>void}) {
  const attempt=useRef<{id:string;disposition:PilotReviewNote['disposition'];reason:string}|null>(null);
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data=new FormData(event.currentTarget);
    const disposition=data.get('disposition') as PilotReviewNote['disposition']; const reason=String(data.get('reason')??'').trim();
    if(reason.length<3||reason.length>1000) return;
    if(!attempt.current||attempt.current.disposition!==disposition||attempt.current.reason!==reason)
      attempt.current={id:crypto.randomUUID(),disposition,reason};
    onSave(attempt.current.id,disposition,reason);
  }
  return <div>
    {notes.filter(note=>note.receiptId===receiptId).map(note=><p key={note.id}><strong>{note.disposition==='REJECTED'?'Rejected suggestion':'Investigation requested'}</strong>: {note.reason} <small>({new Date(note.recordedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}, NZ)</small></p>)}
    <details><summary>Reject this suggestion or flag an investigation</summary>
      <p>This saves your reason for the next review. It does not change any payment.</p>
      <form onSubmit={submit}>
        <label>Decision <select name="disposition" disabled={pending}><option value="INVESTIGATE">Investigate</option><option value="REJECTED">Reject this suggestion</option></select></label>
        <p><label>Reason<br/><textarea name="reason" required minLength={3} maxLength={1000} disabled={pending}/></label></p>
        <Button type="submit" variant="secondary" disabled={pending}>Save review note</Button>
      </form>
    </details>
  </div>;
}
