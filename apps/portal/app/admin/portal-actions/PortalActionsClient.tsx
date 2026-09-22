'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Button, Textarea } from '@/components/ui/foundation/FoundationControls';
import { Badge, Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { parsePortalActionGrant, type PortalActionGrantRequest } from '@/lib/integrations/portalActions/contract';
import GrantReview from './GrantReview';
import { API, canIssue, dateLabel, parseInventory, parseReview, request, RequestFailure, type GrantRow, type Review } from './review';
import styles from './portalActions.module.css';

type IssueState = 'ready' | 'issuing' | 'issued' | 'unknown';
export default function PortalActionsClient() {
  const [raw, setRaw] = useState('');
  const [grant, setGrant] = useState<PortalActionGrantRequest | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [issueState, setIssueState] = useState<IssueState>('ready');
  const [credential, setCredential] = useState<{ token: string; grantId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const generation = useRef(0);
  const inventoryGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = issueState === 'issuing';

  const loadInventory = useCallback(async () => {
    const ticket = ++inventoryGeneration.current;
    setInventoryLoading(true);
    setInventoryError('');
    try { const rows = parseInventory(await request(API)); if (ticket === inventoryGeneration.current) setGrants(rows); }
    catch { if (ticket === inventoryGeneration.current) setInventoryError('Connections could not be refreshed. Refresh before taking further action.'); }
    finally { if (ticket === inventoryGeneration.current) setInventoryLoading(false); }
  }, []);
  useEffect(() => { void loadInventory(); }, [loadInventory]);

  function changeImport(value: string) {
    generation.current += 1;
    setRaw(value); setGrant(null); setReview(null); setConfirmed(false); setMessage(''); setReviewing(false);
  }
  function resetImport() {
    changeImport(''); setIssueState('ready'); setCredential(null); setCopied(false);
    if (fileInput.current) fileInput.current.value = '';
  }
  async function importFile(file?: File) {
    if (!file) return;
    changeImport('');
    const ticket = generation.current;
    if (file.size > 256 * 1024) { setMessage('The approval file is too large. Use a request file under 256 KB.'); return; }
    try { const text = await file.text(); if (ticket === generation.current) changeImport(text); }
    catch { if (ticket === generation.current) setMessage('This file could not be read. Choose it again or paste the approval request.'); }
  }
  async function preview() {
    const ticket = ++generation.current;
    setReviewing(true); setReview(null); setConfirmed(false); setMessage('');
    let parsed: PortalActionGrantRequest;
    try {
      if (new TextEncoder().encode(raw).length > 256 * 1024) throw new Error('Request too large');
      parsed = parsePortalActionGrant(JSON.parse(raw), Date.now());
    }
    catch { setMessage('This approval request is invalid or expired. Import a current request with the exact approved actions.'); setReviewing(false); return; }
    setGrant(parsed);
    try {
      const result = parseReview(await request(`${API}/preview`, parsed), parsed);
      if (ticket === generation.current) setReview(result);
    } catch { if (ticket === generation.current) setMessage('The Portal could not verify this request. No connection was created. Try reviewing again.'); }
    finally { if (ticket === generation.current) setReviewing(false); }
  }
  async function issue() {
    if (!grant || !review || !confirmed || !canIssue(review, grant) || issueState !== 'ready') return;
    setIssueState('issuing'); setMessage('');
    let posted = false;
    try {
      const currentGrant = parsePortalActionGrant(grant, Date.now());
      const fresh = parseReview(await request(`${API}/preview`, currentGrant), currentGrant);
      if (JSON.stringify(fresh) !== JSON.stringify(review) || !canIssue(fresh, currentGrant)) {
        setReview(fresh); setConfirmed(false); setIssueState('ready');
        setMessage('The project review has changed. Check the updated details before authorising.'); return;
      }
      posted = true;
      const result = await request(API, currentGrant) as Record<string, unknown>;
      if (!result || typeof result.token !== 'string' || !/^spa1_[0-9a-f]{64}$/.test(result.token) || typeof result.grantId !== 'string' ||
        result.version !== currentGrant.version || result.environment !== currentGrant.environment) throw new RequestFailure(null);
      setCredential({ token: result.token, grantId: result.grantId }); setIssueState('issued'); setConfirmed(false);
      setMessage('Connection created. The approved actions have not been executed.');
      void loadInventory();
    } catch (error) {
      const knownRejection = error instanceof RequestFailure && error.status !== null && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.status);
      setIssueState(posted && !knownRejection ? 'unknown' : 'ready'); setConfirmed(false);
      setMessage(posted && !knownRejection
        ? 'Creation could not be confirmed. Do not create another connection yet. Refresh Connections below, find this request and revoke any connection created before starting again.'
        : 'The request could not be authorised. Review it again before trying to create a connection.');
      setReview(null);
      if (posted) void loadInventory();
    }
  }
  async function copyCredential() {
    if (!credential || copying) return;
    setCopying(true);
    try { await navigator.clipboard.writeText(credential.token); setCredential(null); setCopied(true); }
    catch { setMessage('The connection key could not be copied. Allow clipboard access and try again before leaving this page.'); }
    finally { setCopying(false); }
  }
  async function revoke(id: string) {
    setRevoking(id); setInventoryError('');
    try {
      const result = await request(`${API}/revoke`, { grantId: id }) as Record<string, unknown>;
      if (result?.grantId !== id || result.revoked !== true) throw new Error('Unconfirmed revocation');
      setGrants((rows) => rows.map((row) => row.id === id ? { ...row, revoked_at: new Date().toISOString() } : row));
      if (credential?.grantId === id) setCredential(null);
      setRevokeTarget(null);
    } catch { setInventoryError('Revocation could not be confirmed. Refresh the connections before relying on its status.'); }
    finally { setRevoking(null); }
  }

  return <PageLayout className={styles.page}>
    <StaffPageHeader title="Portal action connections" subtitle="Review and authorise a bounded set of project actions." />
    <div className={styles.sections}>
      <Card title="1. Import the approved request">
        <p className={styles.muted}>Choose the approval file prepared for this task. Its projects, actions and expiry stay in memory only.</p>
        <div className={styles.row}><label className={styles.fileLabel}>Approval file<input ref={fileInput} type="file" accept=".json,application/json" disabled={busy || issueState !== 'ready'} onChange={(event) => void importFile(event.target.files?.[0])} /></label></div>
        <details className={styles.manifest}><summary>Paste approval request instead</summary><label htmlFor="approval-json">Approval request JSON</label><Textarea id="approval-json" value={raw} onChange={(event) => changeImport(event.target.value)} disabled={busy || issueState !== 'ready'} rows={7} spellCheck={false} /></details>
        <div className={styles.row}><Button onClick={() => void preview()} disabled={!raw.trim() || busy || issueState !== 'ready'} loading={reviewing}>Review projects</Button><Button variant="secondary" onClick={resetImport} disabled={busy}>Clear request</Button><span className={styles.muted}>{raw ? 'Approval request loaded' : 'No file loaded'}</span></div>
      </Card>
      <Card title="2. Review and authorise">
        <div className={styles.feedback} aria-live="polite" role="status">{message || (reviewing ? 'Checking current project details…' : 'Creating a connection authorises only the saved actions. It does not execute them.')}</div>
        <div className={styles.reviewSlot} aria-busy={reviewing || busy}>
          {grant && review ? <GrantReview grant={grant} review={review} /> : <p className={styles.muted}>Import and review a request to see verified project names, current states and any conflicts here.</p>}
        </div>
        <div className={styles.approval}>
          <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!grant || !review || !canIssue(review, grant) || busy || issueState !== 'ready'} /> I have reviewed these projects, actions and expiry.</label>
          <Button onClick={() => void issue()} disabled={!confirmed || !grant || !review || !canIssue(review, grant) || issueState !== 'ready'} loading={busy}>Authorise and create connection</Button>
        </div>
        <div className={styles.credential} aria-live="polite">
          {credential ? <><strong>Connection key ready</strong><p>Your agent can open the Portal Actions connection prompt in the task terminal. Copy this key once, paste it into that prompt, then press Enter. Input is hidden. Never paste the key into chat. If lost, revoke this connection and create a replacement.</p><Button onClick={() => void copyCredential()} loading={copying}>Copy connection key once</Button><Button variant="quiet" onClick={() => setCredential(null)} disabled={copying}>Dismiss key</Button></>
            : copied ? <p>Connection key copied. Paste it into the Portal Actions connection prompt and press Enter. It is no longer available on this page.</p> : issueState === 'issued' ? <p>The connection key is no longer available. Revoke this connection if you need a replacement.</p> : <p className={styles.muted}>Your one-time connection key will appear here after authorisation.</p>}
        </div>
      </Card>
      <Card title="Connections" action={<Button variant="secondary" onClick={() => void loadInventory()} disabled={Boolean(revoking)} loading={inventoryLoading}>Refresh connections</Button>}>
        <p className={styles.muted}>Saved connection records remain available when you return. Revocation stops future use; it does not undo committed actions.</p>
        <div className={styles.feedback} role="status">{inventoryError || (inventoryLoading ? 'Refreshing connections…' : `${grants.length} connection records`)}</div>
        <div className={styles.inventory} aria-busy={inventoryLoading}>
          {!grants.length && !inventoryLoading && !inventoryError && <p>No connections have been created.</p>}
          {grants.map((row) => <article className={styles.project} key={row.id}>
            <div className={styles.row}><strong>{row.label}</strong><Badge>{row.revoked_at ? 'Revoked' : Date.parse(row.expires_at) <= Date.now() ? 'Expired' : 'Active'} · {row.environment}</Badge></div>
            <p>{row.task_reference}</p><p className={styles.muted}>{row.project_count} projects · {row.action_count} approved actions · {row.committed_count} committed<br />Created {dateLabel(row.created_at)} · Expires {dateLabel(row.expires_at)}</p>
            <details><summary>Connection reference</summary><code>{row.id}</code></details>
            {!row.revoked_at && Date.parse(row.expires_at) > Date.now() && <div className={styles.revoke}>
              {revokeTarget === row.id ? <><span>Stop access for this connection?</span><Button variant="destructive" onClick={() => void revoke(row.id)} loading={revoking === row.id} disabled={Boolean(inventoryError) || inventoryLoading || Boolean(revoking)}>Confirm revoke</Button><Button variant="quiet" onClick={() => setRevokeTarget(null)} disabled={Boolean(revoking)}>Cancel</Button></>
                : <Button variant="secondary" onClick={() => setRevokeTarget(row.id)} disabled={Boolean(revoking) || inventoryLoading || Boolean(inventoryError)}>Revoke connection</Button>}
            </div>}
          </article>)}
        </div>
      </Card>
    </div>
  </PageLayout>;
}
