'use client';

import { useEffect, useState } from 'react';
import type { EmailReviewCommand, EmailReviewItem } from '@/lib/emailReview/contracts';
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui/foundation/FoundationControls';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import { type EmailReviewApi, replySubject, safeEvidenceUrl } from './api';
import { contextChanges } from './contextChanges';
import styles from './EmailReview.module.css';

export default function EmailReviewEditor({ item, api, onSaved, onDirty, onBusy }: {
  item: EmailReviewItem; api: EmailReviewApi; onSaved: (item: EmailReviewItem) => void; onDirty: (dirty: boolean) => void; onBusy?: (busy: boolean) => void;
}) {
  const [base, setBase] = useState(item);
  const [to, setTo] = useState(item.to);
  const [body, setBody] = useState(item.body);
  const [threadId, setThreadId] = useState(item.threadMessageId ?? '');
  const [checks, setChecks] = useState(false);
  const [threadChecked, setThreadChecked] = useState(false);
  const [contextChecked, setContextChecked] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [latest, setLatest] = useState<EmailReviewItem | null>(null);
  const thread = base.threads.find(candidate => candidate.messageId === threadId);
  const subject = thread ? replySubject(thread.subject) : base.subject;
  const dirty = to !== base.to || body !== base.body || subject !== base.subject || (threadId || null) !== base.threadMessageId;
  useEffect(() => { onDirty(dirty || Boolean(note.trim()) || busy); }, [dirty, note, busy, onDirty]);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  useEffect(() => { setChecks(false); setThreadChecked(false); setContextChecked(false); }, [to, body, threadId]);
  const locked = busy || Boolean(base.dispatchId) || recovery;
  function accept(saved: EmailReviewItem) {
    setBase(saved); setTo(saved.to); setBody(saved.body); setThreadId(saved.threadMessageId ?? '');
    setNote(''); setChecks(false); setThreadChecked(false); setContextChecked(false); setRecovery(false); setLatest(null); onSaved(saved);
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
        ...(action === 'save' ? { to: to.trim(), subject, body, threadMessageId: threadId || null, acknowledgeContextChange: contextChecked, expectedContextHash: base.currentContextHash } : {}),
        ...(action === 'approve' ? { prerequisitesConfirmed: checks, threadConfirmed: threadChecked } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      accept(saved); setMessage(action === 'approve' ? 'Approval saved. No email has been sent.' : action === 'skip' ? 'Skipped with your note.' : 'Saved.');
    } catch {
      setRecovery(true); setMessage('The change could not be confirmed, or this draft changed elsewhere. Load the saved version before continuing. Your edits have been kept.');
    } finally { setBusy(false); }
  }
  const matchingThread = Boolean(thread && thread.matchedRecipient.trim().toLowerCase() === to.trim().toLowerCase());
  const eligible = ['CONTACTED', 'SENT'].includes(base.currentProjectContext.stage) && base.currentProjectContext.state === 'ACTIVE' && !base.currentProjectContext.archivedAt;
  return <div className={styles.editor}>
    <div><Badge tone={base.status === 'approved' ? 'success' : 'neutral'}>{base.status === 'draft' ? 'Pending review' : base.status === 'approved' ? 'Approved' : 'Skipped'}</Badge><h2>{base.projectName}</h2>
      <a href={`/staff/projects/proj_${base.projectId.replace(/^proj_/, '')}`} target="_blank" rel="noopener noreferrer">Open project</a>
    </div>
    <p className={styles.context}>{base.context}</p>
    <details><summary>Evidence and saved review history</summary><ul>{base.evidence.map((entry, index) => <li key={index}>{safeEvidenceUrl(entry.url) ? <a href={safeEvidenceUrl(entry.url)} target="_blank" rel="noopener noreferrer">{entry.label}</a> : entry.label}</li>)}</ul>
      {base.events.map(event => <p key={event.id}>{event.action} · {new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ''}</p>)}
    </details>
    {base.dispatchId && <p className={styles.notice}>This draft is locked in a sending batch. Its approved contents cannot be edited here.</p>}
    {!eligible && <p className={styles.notice}>Approval is unavailable for this project’s current stage or work state. Only active Contacted or Sent projects are eligible. Check the project or skip this draft with a note.</p>}
    {base.contextChanged && <div className={styles.notice}><strong>Project details changed after this draft was prepared.</strong><ul>{contextChanges(base.savedProjectContext, base.currentProjectContext).map(change => <li key={change}>{change}</li>)}</ul><a href={`/staff/projects/proj_${base.projectId.replace(/^proj_/, '')}`} target="_blank" rel="noopener noreferrer">Check current project details</a><Checkbox label="I have checked the current project and adjusted this draft as needed" checked={contextChecked} disabled={locked} onChange={event => setContextChecked(event.target.checked)} /></div>}
    {recovery && <div role="alert" className={styles.error}><p>{message}</p><Button variant="secondary" loading={busy} onClick={loadLatest}>Load latest saved version</Button>
      {latest && <><p>Saved revision {latest.revision}: {latest.status} · {latest.to}</p><details><summary>Compare saved email</summary><p>{latest.subject}</p><p className={styles.context}>{latest.body}</p></details><div className={styles.actions}>
        <Button variant="secondary" onClick={() => { if (window.confirm('Replace your edits with the latest saved version?')) accept(latest); }}>Use latest saved version</Button>
        <Button disabled={Boolean(latest.dispatchId)} onClick={() => { setBase(latest); setRecovery(false); setLatest(null); setChecks(false); setThreadChecked(false); setContextChecked(false); setMessage('Your edits are kept against the latest revision. Review and save them before approval.'); }}>Keep my edits</Button>
      </div></>}
    </div>}
    <fieldset disabled={locked}>
      <Input label="Recipient" type="email" maxLength={254} value={to} onChange={event => setTo(event.target.value)} />
      <Select label="Outlook conversation" value={threadId} onChange={event => setThreadId(event.target.value)}><option value="">Choose a conversation</option>{base.threads.map(candidate => <option key={candidate.messageId} value={candidate.messageId}>{candidate.subject} · {candidate.matchedRecipient}</option>)}</Select>
      {thread && safeEvidenceUrl(thread.webLink) && <a href={safeEvidenceUrl(thread.webLink)} target="_blank" rel="noopener noreferrer">Open selected conversation in Outlook</a>}
      {!matchingThread && <p className={styles.notice}>A conversation matched to this recipient is needed before approval. Leave pending or skip with a note if the correct conversation is unavailable.</p>}
      <Input label="Reply subject (from Outlook conversation)" value={subject} readOnly helperText="Replies retain the selected Outlook conversation’s subject." />
      <Textarea label="Email body" rows={13} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} />
      <div><h3>Checks before approval</h3><ul>{base.prerequisites.map((prerequisite, index) => <li key={index}>{prerequisite}</li>)}</ul>
        <Checkbox label="I have completed the checks above and reviewed this draft" checked={checks} disabled={dirty || base.contextChanged} onChange={event => setChecks(event.target.checked)} />
        <Checkbox label="I checked the selected conversation for newer replies and confirmed the recipient" checked={threadChecked} disabled={dirty || !matchingThread || base.contextChanged} onChange={event => setThreadChecked(event.target.checked)} />
      </div>
      <Input label="Review note (required to skip)" value={note} maxLength={2000} onChange={event => setNote(event.target.value)} />
    </fieldset>
    <div className={styles.status} role="status">{!recovery ? message || (dirty ? 'Unsaved edits. Save before approving; saving changes removes an earlier approval.' : 'Approval records your review. It does not send an email.') : ''}</div>
    <div className={styles.actions}>
      <Button variant="secondary" disabled={locked || (!dirty && !contextChecked) || !to.trim() || !body.trim() || (base.contextChanged && !contextChecked)} onClick={() => command('save')}>Save edits</Button>
      <Button disabled={locked || dirty || !checks || !threadChecked || !matchingThread || !eligible || base.contextChanged || base.status === 'approved'} onClick={() => command('approve')}>Approve draft</Button>
      {base.status === 'approved' && <Button variant="secondary" disabled={locked || dirty} onClick={() => command('unapprove')}>Return to pending</Button>}
      <Button variant="quiet" disabled={locked || dirty || !note.trim()} onClick={() => command('skip')}>Skip with note</Button>
    </div>
  </div>;
}
