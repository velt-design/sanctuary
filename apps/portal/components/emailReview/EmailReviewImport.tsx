'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import type { EmailReviewImport as ImportPayload, EmailReviewImportItem } from '@/lib/emailReview/contracts';
import { parseReviewImport } from '@/lib/emailReview/validation';
import type { EmailReviewApi, Reviewer } from './api';
import styles from './EmailReview.module.css';

export const reviewImportMaxBytes = 2 * 1024 * 1024;
export function validateImportPayload(value: ImportPayload): ImportPayload {
  if (value.items.length > 500) throw new Error('A batch can contain at most 500 drafts. Nothing was imported.');
  let parsed: ImportPayload;
  try { parsed = parseReviewImport(value); }
  catch { throw new Error('The batch contains invalid fields. Check the source key, title, reviewer and draft contents. Nothing was imported.'); }
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > reviewImportMaxBytes) {
    throw new Error('The complete import exceeds 2 MiB, including batch details and reviewer information. Reduce the batch size. Nothing was imported.');
  }
  return parsed;
}

export default function EmailReviewImport({ api, onImported }: { api: EmailReviewApi; onImported: (id: string) => void }) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<EmailReviewImportItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.reviewers().then(rows => { if (active) setReviewers(rows); }).catch(() => { if (active) setError('Could not load reviewers. Close and reopen import to retry.'); }); return () => { active = false; }; }, [api]);
  async function readFile(file?: File) {
    setItems([]); setError('');
    if (!file) return;
    if (file.size > reviewImportMaxBytes) { setError('Choose a JSON file no larger than 2 MiB. Nothing was imported.'); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !('items' in parsed) || !Array.isArray(parsed.items) || !parsed.items.length) throw new Error();
      if (parsed.items.length > 500) { setError('A batch can contain at most 500 drafts. Nothing was imported.'); return; }
      setItems(parsed.items);
      setSourceKey('sourceKey' in parsed && typeof parsed.sourceKey === 'string' ? parsed.sourceKey : '');
      setTitle('title' in parsed && typeof parsed.title === 'string' ? parsed.title : '');
    } catch { setError('This file must contain a JSON object with a non-empty items array. Nothing was imported.'); }
  }
  async function submit() {
    setError('');
    let input: ImportPayload;
    try { input = validateImportPayload({ commandId: crypto.randomUUID(), sourceKey: sourceKey.trim(), title: title.trim(), reviewerId, items }); }
    catch (error) { setError(error instanceof Error ? error.message : 'Invalid import. Nothing was imported.'); return; }
    setBusy(true);
    try { const result = await api.importBatch(input); onImported(result.batchId); }
    catch { setError('Import could not be confirmed. Retry the same source key to check for an existing batch; do not create a new source key.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.import} aria-label="Import review batch"><h2>Import review batch</h2><p>Assign a reviewer and import prepared drafts. Maximum 500 drafts and 2 MiB including batch details. Importing does not approve or send them.</p>
    <Input label="Prepared JSON file" type="file" accept="application/json,.json" disabled={busy} onChange={event => { void readFile(event.target.files?.[0]); }} />
    <Input label="Source key" value={sourceKey} disabled={busy} onChange={event => setSourceKey(event.target.value)} helperText="Keep the original key when retrying an import." />
    <Input label="Batch title" value={title} disabled={busy} onChange={event => setTitle(event.target.value)} />
    <Select label="Assigned reviewer" value={reviewerId} disabled={busy} onChange={event => setReviewerId(event.target.value)}><option value="">Choose a staff member</option>{reviewers.map(reviewer => <option key={reviewer.id} value={reviewer.id}>{reviewer.name || reviewer.email} ({reviewer.role})</option>)}</Select>
    <p>{items.length} drafts selected</p>{error && <p role="alert" className={styles.error}>{error}</p>}
    <Button loading={busy} disabled={!reviewerId || !sourceKey.trim() || !title.trim() || !items.length} onClick={submit}>Import drafts</Button>
  </section>;
}
