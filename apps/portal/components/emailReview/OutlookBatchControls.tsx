'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Textarea } from '@/components/ui/foundation/FoundationControls';
import { apiJson } from '@/lib/repo/apiClient';
import type { DispatchClaim, DispatchResult } from '@/lib/emailReview/dispatch/contracts';
import { parseDispatchResult } from '@/lib/emailReview/dispatch/validation';
import styles from './EmailReview.module.css';

export function parseDispatchResults(text: string): DispatchResult[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || !value.length || value.length > 10) throw new Error('Enter an array of 1 to 10 results.');
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || typeof row.intentId !== 'string' || typeof row.attemptId !== 'string' || !['sent', 'uncertain'].includes(row.outcome) || ids.has(row.intentId)) throw new Error('Each result needs a unique intentId, attemptId and sent or uncertain outcome.');
    ids.add(row.intentId);
  }
  try { return value.map(parseDispatchResult); } catch { throw new Error('Result fields are invalid. Sent results require an Outlook message ID and link; uncertain results must not include those receipts.'); }
}
export default function OutlookBatchControls({ batchId, disabled = false, onChanged }: { batchId: string; disabled?: boolean; onChanged?: () => void }) {
  const [claim, setClaim] = useState<DispatchClaim | null>(null);
  const [results, setResults] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertainClaim, setUncertainClaim] = useState(false);
  const claimId = useRef<string | null>(null);
  const storageKey = `portal.email-review.claim.${batchId}`;
  useEffect(() => {
    setClaim(null); setResults(''); setUncertainClaim(false); setMessage(''); claimId.current = null;
    try { const existing = sessionStorage.getItem(storageKey); if (existing) { claimId.current = existing; setUncertainClaim(true); setMessage('A previous claim needs reconciliation. Recover it and check send progress before any Outlook action.'); } }
    catch { setMessage('Browser recovery storage is unavailable. Keep this page open until every claimed reply is reconciled.'); }
  }, [storageKey]);
  const endpoint = `/api/admin/email-review/${encodeURIComponent(batchId)}/dispatch`;
  async function start() {
    setBusy(true); setMessage('');
    claimId.current ??= crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, claimId.current); } catch { /* Server command ID remains in this live page. */ }
    try {
      const next = await apiJson<DispatchClaim>(`${endpoint}/claim`, { method: 'POST', body: JSON.stringify({ commandId: claimId.current, limit: 10 }) });
      setClaim(next); setUncertainClaim(next.replayed);
      setMessage(next.replayed ? 'This claim was already used. Its reply payload cannot be retrieved again. Check Outlook records and reconcile every attempted message using send progress below. Do not send or allocate a replacement group.' : `${next.replies.length} replies claimed. No email has been sent by this page.`);
      if (!next.replayed && !next.replies.length) { claimId.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* Empty claim has no work to recover. */ } }
      onChanged?.();
    }
    catch { setUncertainClaim(true); setMessage('The claim outcome is unknown. Recover this same claim; do not start a new one or send until its state is checked.'); }
    finally { setBusy(false); }
  }
  async function record() {
    let pending: DispatchResult[];
    try { pending = parseDispatchResults(results); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid result JSON.'); return; }
    setBusy(true); let completed = 0;
    try {
      for (const result of pending) {
        await apiJson(`${endpoint}/result`, { method: 'POST', body: JSON.stringify(result) });
        completed++; setResults(JSON.stringify(pending.slice(completed), null, 2));
      }
      setMessage(`${completed} results recorded. Refresh send progress before starting another group.`);
      const remaining = claim?.replies.filter(reply => !pending.some(result => result.intentId === reply.id)) ?? [];
      setClaim(claim && remaining.length ? { ...claim, replies: remaining } : null);
      if (!remaining.length) { claimId.current = null; setUncertainClaim(false); try { sessionStorage.removeItem(storageKey); } catch { /* No private payload is stored. */ } }
      onChanged?.();
    } catch { setMessage(`${completed} results recorded. Remaining rows are kept below; verify send progress before retrying a result with an uncertain save. Never retry the Outlook email automatically.`); onChanged?.(); }
    finally { setBusy(false); }
  }
  return <details className={styles.import}><summary>Outlook batch controls</summary><p>Admin controls for the connected Outlook agent. Starting a group reserves up to 10 approved replies. The agent sends them through Outlook and records the outcome here. This page cannot send email.</p>
    <Button variant="secondary" disabled={disabled || busy || Boolean(claim?.replies.length) || Boolean(claim?.replayed)} onClick={start}>{uncertainClaim ? 'Recover same claim' : 'Start next 10'}</Button>
    {claim && <Textarea label="Claimed Outlook reply payload" readOnly rows={10} value={JSON.stringify(claim, null, 2)} />}
    <Textarea label="Outlook results JSON" rows={8} value={results} disabled={disabled || busy} onChange={event => setResults(event.target.value)} helperText="Array of results with intentId, attemptId, outcome (sent or uncertain) and Outlook receipt fields. Mark an ambiguous send uncertain; never resend it automatically." />
    <Button disabled={disabled || busy || !results.trim()} onClick={record}>Record Outlook results</Button><p role="status">{message}</p>
  </details>;
}
