'use client';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { personKey } from '@/lib/siteVisits/reviewedVisit';
import { calendarVisitDateEstimate } from '@/lib/siteVisits/visitDateEstimate';
import { visitPeople,type VisitEditorDraft } from './visitEditorModel';
import styles from './visitEditor.module.css';

export default function VisitDetailFields({visit,draft,onChange}:{visit?:CalendarVisit;draft:VisitEditorDraft;onChange:(draft:VisitEditorDraft)=>void}){
  const change=(patch:Partial<VisitEditorDraft>)=>onChange({...draft,...patch});
  return <div className={styles.fields}>
    <fieldset className={styles.people}><legend>Attending staff</legend>{visitPeople(visit).map(person=>{const key=personKey(person),checked=draft.staff.some(p=>personKey(p)===key);return <label key={key}><input type="checkbox" checked={checked} onChange={e=>change({staff:e.target.checked?[...draft.staff,person]:draft.staff.filter(p=>personKey(p)!==key)})} />{person.name}</label>;})}</fieldset>
    <label className={styles.full}>Site address<input value={draft.address} maxLength={500} onChange={e=>change({address:e.target.value})} placeholder="Leave blank if it still needs checking" /></label>
    <label>Visit type<select value={draft.purpose} onChange={e=>change({purpose:e.target.value as VisitEditorDraft['purpose']})}><option value="site_visit">Site visit</option><option value="initial">Original site visit</option><option value="measurement">Return measurement</option><option value="follow_up">Follow-up visit</option></select></label>
    <label>{visit?.origin==='history'||!visit?'Recorded outcome':'Booking status'}<select value={draft.status} onChange={e=>change({status:e.target.value})}>
      {visit&&visit.origin!=='history'&&<><option value="source">Use Outlook status</option><option value="booked">Booked</option><option value="provisional">Provisional</option><option value="cancelled">Cancelled booking</option></>}
      <option value="attended">Attendance is recorded</option><option value="not_attended">Did not take place</option>
    </select></label>
    <label className={styles.full}>Known timing<select value={draft.timingMode} onChange={e=>change({timingMode:e.target.value})}>
      {visit&&visit.origin!=='history'&&<option value="source">As booked in Outlook</option>}<option value="agreed">Agreed appointment time</option><option value="window">Access window</option><option value="date">Date only, time not recorded</option><option value="unknown">Date and time not recorded</option>
    </select></label>
    {!['source','unknown'].includes(draft.timingMode)&&<label>Date (New Zealand)<input type="date" value={draft.date} required onChange={e=>change({date:e.target.value})} /></label>}
    {visit&&calendarVisitDateEstimate(visit)&&draft.timingMode==='date'&&draft.date===visit.timing?.date&&<p className={styles.hint}>{calendarVisitDateEstimate(visit)==='quote'?'Approximate date from the original quote.':'Owner-approved approximate visit date based on acceptance.'} Included in visit results, excluded from elapsed-time measures.</p>}
    {['agreed','window'].includes(draft.timingMode)&&<label>{draft.timingMode==='window'?'Access from':'Agreed time'}<input type="time" value={draft.time} required onChange={e=>change({time:e.target.value})} /></label>}
    {draft.timingMode==='window'&&<label>Access until<input type="time" value={draft.endTime} required onChange={e=>change({endTime:e.target.value})} /></label>}
    {draft.timingMode==='agreed'&&<p className={styles.hint}>This records the agreed time, not an actual arrival or departure.</p>}
    {draft.timingMode==='window'&&<p className={styles.hint}>This records when access was available, not the duration of attendance.</p>}
    <label className={styles.full}>Basis for these details<textarea value={draft.basis} minLength={5} maxLength={2000} required onChange={e=>change({basis:e.target.value})} placeholder="For example: address from the linked project; attendance confirmed by the staff member." /></label>
    <label className={styles.full}>Still needs an answer<textarea value={draft.questions} maxLength={2400} onChange={e=>change({questions:e.target.value})} placeholder="One specific question per line. Leave empty when the known facts are settled." /></label>
    <details className={styles.full}><summary>Supporting source link (optional)</summary><label>Source link<input type="url" value={draft.referenceUrl} maxLength={3000} onChange={e=>change({referenceUrl:e.target.value})} placeholder="https://…" /></label></details>
  </div>;
}
