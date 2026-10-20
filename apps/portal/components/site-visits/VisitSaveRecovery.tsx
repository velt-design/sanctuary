import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { visitScheduleLabel } from '@/lib/siteVisits/calendarModel';
import { visitPurposeLabel,visitStaffLabel,visitStatusLabel } from '@/lib/siteVisits/reviewedVisit';
import styles from './visitEditor.module.css';

export default function VisitSaveRecovery({recovery,pending,onReload,onAcknowledge}:{
  recovery:{outcome:'unknown'|'saved'|'conflict';ready:boolean;latest:CalendarVisit|null};
  pending:boolean;onReload:()=>void;onAcknowledge:()=>void;
}){
  const {outcome,ready,latest}=recovery;
  return <div className={styles.notice} role="status">
    <p>{outcome==='saved'?'Your changes were saved, but the page could not refresh.':outcome==='conflict'?'This visit changed before your save completed.':'We could not confirm whether your changes were saved. They may already be saved.'} Your draft is kept. Reload the latest visit before saving again, or cancel to close this form.</p>
    <button type="button" disabled={pending} onClick={onReload}>Reload latest visit</button>
    {ready&&<><p>{latest?'Latest saved details:':'No saved record was found. A retry will use the same record ID.'}</p>
      {latest&&<><p>{visitStaffLabel(latest.staff)||'Staff not recorded'} · {visitScheduleLabel(latest)}</p><p>{latest.address??'Address not recorded'}</p>
        <p>{visitPurposeLabel(latest.purpose)} · {latest.withdrawn?'Withdrawn record':visitStatusLabel(latest.status)??(latest.cancelled?'Cancelled booking':'Calendar booking')}</p>
        {latest.correction&&<p>{latest.correction.basis}</p>}</>}
      <button type="button" disabled={pending} onClick={onAcknowledge}>Keep my draft and use latest revision</button>
    </>}
  </div>;
}
