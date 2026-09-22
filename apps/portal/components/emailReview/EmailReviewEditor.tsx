'use client';

import { useEffect, useState } from 'react';
import type { EmailReviewCommand, EmailReviewItem } from '@/lib/emailReview/contracts';
import { reviewDelivery } from '@/lib/emailReview/delivery';
import { Button, Input, Textarea } from '@/components/ui/foundation/FoundationControls';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import { type EmailReviewApi, safeEvidenceUrl } from './api';
import { contextChanges } from './contextChanges';
import styles from './EmailReview.module.css';

export default function EmailReviewEditor({ item, api, onSaved, onDirty, onBusy }: {
  item: EmailReviewItem; api: EmailReviewApi; onSaved: (item: EmailReviewItem) => void; onDirty: (dirty: boolean) => void; onBusy?: (busy: boolean) => void;
}) {
  const [base, setBase] = useState(item);
  const [to, setTo] = useState(item.to);
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [latest, setLatest] = useState<EmailReviewItem | null>(null);
  const delivery = reviewDelivery(base.threads, to, subject);
  const visibleSubject = base.dispatchId ? base.subject : delivery.subject;
  const dirty = to !== base.to || body !== base.body || visibleSubject !== reviewDelivery(base.threads, base.to, base.subject).subject;
  useEffect(() => { onDirty(dirty || Boolean(note.trim()) || busy); }, [dirty, note, busy, onDirty]);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  const locked = busy || Boolean(base.dispatchId) || recovery;
  const eligible = ['CONTACTED', 'SENT'].includes(base.currentProjectContext.stage) && base.currentProjectContext.state === 'ACTIVE' && !base.currentProjectContext.archivedAt;
  function acceptSaved(saved: EmailReviewItem) {
    setBase(saved); setTo(saved.to); setSubject(saved.subject); setBody(saved.body);
    setNote(''); setRecovery(false); setLatest(null); onSaved(saved);
  }
  async function loadLatest() {
    setBusy(true);
    try { setLatest(await api.item(base.batchId, base.id)); setMessage('Latest saved version loaded. Your text is still in the editor.'); }
    catch { setMessage('Could not load the saved version. Your text is still here. Try again.'); }
    finally { setBusy(false); }
  }
  async function command(action: EmailReviewCommand['action']) {
    setBusy(true); setMessage('');
    try {
      const saved = await api.command(base.batchId, base.id, {
        commandId: crypto.randomUUID(), expectedRevision: base.revision, action,
        ...(['save','accept'].includes(action) ? { to: to.trim(), subject: visibleSubject, body, expectedContextHash: base.currentContextHash } : {}),
        ...(action === 'save' ? { acknowledgeContextChange: base.contextChanged } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      acceptSaved(saved); setMessage(action === 'accept' ? 'Accepted. Your edits are saved. No email has been sent.' : action === 'skip' ? 'Skipped.' : 'Saved.');
    } catch {
      setRecovery(true); setMessage('This change could not be confirmed, or the draft changed elsewhere. Load the saved version before continuing. Your edits have been kept.');
    } finally { setBusy(false); }
  }
  return <div className={styles.editor}>
    <div><Badge tone={base.status === 'approved' ? 'success' : 'neutral'}>{base.status === 'draft' ? 'Pending' : base.status === 'approved' ? 'Accepted' : 'Skipped'}</Badge><h2>{base.projectName}</h2></div>
    {base.dispatchId && <p className={styles.notice}>This accepted message is in a sending batch and is locked.</p>}
    {!eligible && <p className={styles.notice}>This project is no longer an active enquiry or proposal. Check the project before accepting, or skip this message.</p>}
    {base.contextChanged && <div className={styles.notice}><strong>Project details changed since this draft was prepared.</strong><ul>{contextChanges(base.savedProjectContext, base.currentProjectContext).map(change => <li key={change}>{change}</li>)}</ul><p>Check these changes and revise the message if needed. Accept will use the current details shown here.</p><a href={`/staff/projects/proj_${base.projectId.replace(/^proj_/, '')}`} target="_blank" rel="noopener noreferrer">Open current project</a></div>}
    {recovery && <div role="alert" className={styles.error}><p>{message}</p><Button variant="secondary" loading={busy} onClick={loadLatest}>Load latest saved version</Button>
      {latest && <><p>Saved revision {latest.revision}: {latest.status === 'approved' ? 'Accepted' : latest.status} · {latest.to}</p><details><summary>Compare saved email</summary><p>{latest.subject}</p><p className={styles.context}>{latest.body}</p></details><div className={styles.actions}>
        <Button variant="secondary" onClick={() => { if (window.confirm('Replace your edits with the latest saved version?')) acceptSaved(latest); }}>Use latest saved version</Button>
        <Button disabled={Boolean(latest.dispatchId)} onClick={() => { setBase(latest); setRecovery(false); setLatest(null); setMessage('Your edits are kept. Review the current details, then accept.'); }}>Keep my edits</Button>
      </div></>}
    </div>}
    <fieldset disabled={locked}>
      <Input label="Recipient" type="email" maxLength={254} value={to} onChange={event => setTo(event.target.value)} />
      <Input label="Subject" maxLength={300} value={visibleSubject} onChange={event => setSubject(event.target.value)} />
      <Textarea label="Email body" rows={10} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} />
    </fieldset>
    <details><summary>Project context and review history</summary>
      <p className={styles.context}>{base.context}</p><a href={`/staff/projects/proj_${base.projectId.replace(/^proj_/, '')}`} target="_blank" rel="noopener noreferrer">Open project</a>
      {!!base.prerequisites.length && <ul>{base.prerequisites.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}
      <p>{delivery.mode === 'reply' ? 'Uses the matching Outlook conversation.' : 'Will be sent as a fresh email.'}</p>
      <ul>{base.evidence.map((entry, index) => <li key={index}>{safeEvidenceUrl(entry.url) ? <a href={safeEvidenceUrl(entry.url)} target="_blank" rel="noopener noreferrer">{entry.label}</a> : entry.label}</li>)}</ul>
      {base.events.map(event => <p key={event.id}>{event.action === 'accept' ? 'Accepted' : event.action} · {new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ''}</p>)}
      <Input label="Review note (optional)" disabled={locked} value={note} maxLength={2000} onChange={event => setNote(event.target.value)} />
    </details>
    <div className={styles.status} role="status">{!recovery ? message || (dirty ? 'Accept saves your changes and approves this message.' : 'Accept approves this message. It does not send it.') : ''}</div>
    <div className={styles.actions}>
      <Button disabled={locked || !eligible || !to.trim() || !visibleSubject.trim() || !body.trim() || (base.status === 'approved' && !dirty && !base.contextChanged)} onClick={() => command('accept')}>{dirty ? 'Save and accept' : 'Accept'}</Button>
      <Button variant="secondary" disabled={locked || (!dirty && !base.contextChanged) || !to.trim() || !visibleSubject.trim() || !body.trim()} onClick={() => command('save')}>Save draft</Button>
      <Button variant="quiet" disabled={locked || dirty} onClick={() => command('skip')}>Skip</Button>
      {base.status === 'approved' && <Button variant="quiet" disabled={locked || dirty} onClick={() => command('unapprove')}>Return to pending</Button>}
    </div>
  </div>;
}
