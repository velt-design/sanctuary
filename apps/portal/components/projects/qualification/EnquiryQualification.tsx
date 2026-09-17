'use client';
import { useEffect, useRef, useState } from 'react';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { StableCommandAttempt, projectCommandIntent } from '@/lib/projects/workItems/stableCommandAttempt';
import { assessmentError, qualificationCriteria, qualificationLabels, qualificationViewSchema,
  type QualificationCommand, type QualificationCriteria, type QualificationState, type QualificationView } from '@/lib/projects/qualification/contract';
import styles from './EnquiryQualification.module.css';

export type QualificationTransport = (path: string, command?: QualificationCommand) => Promise<{ qualification: QualificationView }>;
const requestQualification: QualificationTransport = (path, command) => apiJson(path,
  command ? { method: 'POST', body: JSON.stringify(command) } : { cache: 'no-store' });

export default function EnquiryQualification({ projectId, enquiryId, transport = requestQualification }: {
  projectId: string; enquiryId: string; transport?: QualificationTransport;
}) {
  const path = `/api/staff/projects/${encodeURIComponent(projectId)}/enquiries/${encodeURIComponent(enquiryId)}/qualification`;
  const [view, setView] = useState<QualificationView | null>(null);
  const [criteria, setCriteria] = useState<QualificationCriteria>({ location: null, project: null, contactAndConfiguration: null, intent: null });
  const [state, setState] = useState<QualificationState>('unreviewed');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const attempt = useRef(new StableCommandAttempt());
  const sequence = useRef(0);
  const saving = useRef(false);
  function accept(data: unknown) {
    const next = qualificationViewSchema.parse(data);
    if (next.enquiryId !== enquiryId || next.projectId !== uuidFromAppId(projectId, 'proj')) throw new Error('Source mismatch');
    setView(next); setCriteria(next.current.criteria); setState(next.current.state); setReason(''); setStale(false);
  }
  useEffect(() => {
    const current = ++sequence.current;
    setBusy(true); setView(null); setError(''); setSaved(false); setStale(false);
    transport(path).then(data => { if (sequence.current === current) accept(data.qualification); })
      .catch(() => { if (sequence.current === current) setError('The saved assessment could not be loaded.'); })
      .finally(() => { if (sequence.current === current) setBusy(false); });
    return () => { sequence.current++; };
    // Source identity is included in path; transport changes only in the gated synthetic fixture.
  }, [path, transport, reload]);
  async function save() {
    if (!view || busy || stale || saving.current) return;
    const problem = assessmentError(state, criteria, reason, view.current.version);
    if (problem) { setError(problem); return; }
    const payload = { expectedVersion: view.current.version, state, criteria, reason: reason.trim() };
    const intent = projectCommandIntent(path, payload);
    const current = sequence.current;
    saving.current = true;
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await transport(path, { ...payload, commandId: attempt.current.commandIdFor(intent) });
      if (sequence.current !== current) return;
      accept(result.qualification); attempt.current.committed(intent); setSaved(true);
    } catch (cause) {
      if (sequence.current !== current) return;
      const conflict = cause instanceof ApiError && cause.status === 409;
      setStale(conflict);
      setError(conflict ? 'Another review may have been saved. Reload the latest assessment before continuing.' : 'Save could not be confirmed. Retry the same assessment, or reload to check its saved state.');
    } finally { saving.current = false; if (sequence.current === current) setBusy(false); }
  }
  const dirty = view && (state !== view.current.state || JSON.stringify(criteria) !== JSON.stringify(view.current.criteria) || !!reason);
  if (busy && !view) return <p role="status">Loading qualification…</p>;
  if (!view) return <div className={styles.card}><p role="alert">{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>Retry qualification</button></div>;
  if (!view.eligible) return null;
  return <section className={styles.card} aria-label="Configured enquiry qualification">
    <div className={styles.heading}><h4>Enquiry qualification</h4><span className={styles.badge}>Saved: {qualificationLabels[view.current.state]}</span></div>
    <p>Review this submitted design and the customer’s details. Leave unknown criteria unreviewed. This decision does not change the project stage or follow-ups.</p>
    {view.current.recordedAt && <p className={styles.meta}>Reviewed by {view.current.actorEmail || 'staff'} · {new Date(view.current.recordedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ time</p>}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || stale} className={styles.fields}><legend>Four criteria</legend>
        {qualificationCriteria.map(([key, label]) => <label key={key} className={styles.row}>
          <span>{label}</span><select aria-label={label} value={criteria[key] === null ? 'unknown' : criteria[key] ? 'yes' : 'no'} onChange={event => { setCriteria(previous => ({ ...previous, [key]: event.target.value === 'unknown' ? null : event.target.value === 'yes' })); setSaved(false); setError(''); }}>
            <option value="unknown">Unknown / not reviewed</option><option value="yes">Confirmed</option><option value="no">Not met</option>
          </select></label>)}
        <label className={styles.row}><span>Review outcome</span><select value={state} onChange={event => { setState(event.target.value as QualificationState); setSaved(false); setError(''); }}>
          <option value="unreviewed">Unreviewed</option><option value="qualified">Qualified</option><option value="not_qualified">Not qualified</option>
        </select></label>
        <label className={styles.reason}> {view.current.version ? 'Reason for correction (required)' : state === 'not_qualified' ? 'Reason (required)' : 'Review note (optional)'}
          <textarea value={reason} maxLength={1000} rows={3} onChange={event => { setReason(event.target.value); setSaved(false); }} />
        </label>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {saved && <p role="status">Assessment saved. The current saved decision is shown above.</p>}
      {dirty && !saved && <p className={styles.meta}>Unsaved assessment</p>}
      <div className={styles.actions}><button type="submit" disabled={busy || stale}>{busy ? 'Saving…' : 'Save assessment'}</button>
        <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload saved assessment</button></div>
    </form>
    {!!view.history.length && <details className={styles.history}><summary>Review history ({view.current.version})</summary>
      {view.current.version > view.history.length && <p>Showing the latest 20 reviews. Earlier decisions remain in the audit record.</p>}
      <ol>{view.history.map(review => <li key={review.version}><strong>{qualificationLabels[review.state]}</strong> · {review.actorEmail || 'staff'} · {review.recordedAt && new Date(review.recordedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ time
        <ul>{qualificationCriteria.map(([key,label]) => <li key={key}>{label}: {review.criteria[key] === null ? 'Unknown' : review.criteria[key] ? 'Confirmed' : 'Not met'}</li>)}</ul>
        {review.reason && <p>{review.reason}</p>}<small>Criteria v1 · review {review.version}</small></li>)}</ol>
    </details>}
  </section>;
}
