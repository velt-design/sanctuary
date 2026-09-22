'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { Pagination } from '@/components/ui/foundation/FoundationPagination';
import { useUnsavedChangesGuard } from '@/components/ui/foundation/useUnsavedChangesGuard';
import type { EmailReviewBatchPage, EmailReviewItem, EmailReviewStatus } from '@/lib/emailReview/contracts';
import { emailReviewApi, type EmailReviewApi, type ReviewSession } from './api';
import EmailReviewEditor from './EmailReviewEditor';
import EmailReviewImport from './EmailReviewImport';
import EmailDispatchPanel from './EmailDispatchPanel';
import styles from './EmailReview.module.css';

export default function EmailReviewWorkspace({ api = emailReviewApi, synthetic = false }: { api?: EmailReviewApi; synthetic?: boolean }) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [batchId, setBatchId] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | EmailReviewStatus>('draft');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<EmailReviewBatchPage | null>(null);
  const [selected, setSelected] = useState('');
  const [item, setItem] = useState<EmailReviewItem | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailVersion, setDetailVersion] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const guard = useUnsavedChangesGuard(dirty, 'Discard unsaved draft edits and review notes?');
  const updateDirty = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => { let active = true; api.session().then(value => { if (active) { setSession(value); setBatchId(current => current || value.batches[0]?.id || ''); setLoading(false); } }).catch(() => { if (active) { setError('Could not load your review batches.'); setLoading(false); } }); return () => { active = false; }; }, [api, version]);
  useEffect(() => {
    if (!batchId) return;
    let active = true; setLoading(true); setError('');
    api.page(batchId, page, status, query).then(value => { if (active) setRows(value); }).catch(() => { if (active) { setRows(null); setError('Could not load this draft list. Your saved review has not been changed.'); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, batchId, page, status, query, version]);
  useEffect(() => {
    if (!selected || !batchId) { setItem(null); return; }
    let active = true; setItem(null); setDetailError('');
    api.item(batchId, selected).then(value => { if (active) setItem(value); }).catch(() => { if (active) setDetailError('Could not load this draft. Choose it again to retry.'); });
    return () => { active = false; };
  }, [api, batchId, selected, detailVersion]);
  useEffect(() => { if (detailRef.current) detailRef.current.scrollTop = 0; }, [selected]);
  // Guard links outside the editor as well as list/filter navigation.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (anchor && anchor.target !== '_blank' && (saving || !window.confirm('Discard unsaved draft edits and review notes?'))) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener('click', handler, true); return () => document.removeEventListener('click', handler, true);
  }, [dirty, saving]);
  function navigate(action: () => void) { if (!saving) guard(() => { setDirty(false); setSelected(''); setItem(null); action(); }); }
  const counts = rows?.counts;
  return <PageLayout>
    <StaffPageHeader title="Email review" variant="index" description="Read each message, revise it if needed, then accept. Accepting does not send email." />
    {synthetic && <p className={styles.notice}>Synthetic review preview — example data only. Changes are saved in this browser. Nothing can be sent.</p>}
    {session?.isAdmin && <Button variant="secondary" disabled={saving} onClick={() => guard(() => setShowImport(value => !value))}>{showImport ? 'Close import' : 'Import review batch'}</Button>}
    {showImport && <EmailReviewImport api={api} onImported={id => navigate(() => { setBatchId(id); setPage(1); setShowImport(false); setVersion(value => value + 1); })} />}
    <div className={styles.toolbar}>
      <Select label="Review batch" disabled={saving} value={batchId} onChange={event => navigate(() => { setBatchId(event.target.value); setPage(1); })}><option value="">Choose a batch</option>{session?.batches.map(batch => <option key={batch.id} value={batch.id}>{batch.title}</option>)}</Select>
      <Select label="Review status" disabled={saving} value={status} onChange={event => navigate(() => { setStatus(event.target.value as typeof status); setPage(1); })}><option value="draft">Pending</option><option value="approved">Accepted</option><option value="skipped">Skipped</option><option value="all">All drafts</option></Select>
      <form className={styles.search} onSubmit={event => { event.preventDefault(); navigate(() => { setQuery(search); setPage(1); }); }}><Input label="Find a project or recipient" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="secondary" type="submit">Search</Button></form>
    </div>
    <div className={styles.counts} aria-live="polite">{counts ? <><span>{counts.all} total</span><span>{counts.draft} pending</span><span>{counts.approved} accepted</span><span>{counts.skipped} skipped</span></> : null}</div>

    {error && <div role="alert" className={styles.error}>{error} <Button variant="secondary" onClick={() => setVersion(value => value + 1)}>Retry</Button></div>}
    <div className={`${styles.workspace} ${selected ? styles.selected : ''}`}>
      <div className={styles.list} aria-label="Drafts" aria-busy={loading}>{loading && !rows ? <p>Loading drafts…</p> : rows?.items.length ? rows.items.map(row => <button type="button" key={row.id} className={styles.row} aria-current={selected === row.id} disabled={saving || loading} onClick={() => { if (selected === row.id && !detailError) return; guard(() => { setDirty(false); setSelected(row.id); if (selected === row.id && detailError) { setDetailVersion(value => value + 1); } }); }}><strong>{row.projectName}</strong><small>{row.to}</small><small>{row.status === 'draft' ? 'Pending' : row.status === 'approved' ? 'Accepted' : 'Skipped'}{row.contextChanged ? ' · Project changed' : ''}</small></button>) : !error ? <p>{batchId ? 'No drafts match this view.' : 'No review batches are assigned to you.'}</p> : null}</div>
      <section ref={detailRef} className={styles.detail} aria-label="Selected draft"><div className={styles.back}><Button variant="secondary" onClick={() => navigate(() => undefined)}>Back to drafts</Button></div>{item ? <EmailReviewEditor key={item.id} item={item} api={api} onDirty={updateDirty} onBusy={setSaving} onSaved={saved => { setItem(saved); setDirty(false); setVersion(value => value + 1); }} /> : <p role="status">{detailError || (selected ? 'Loading selected draft…' : 'Choose a draft to review.')}</p>}</section>
    </div>
    {batchId && !synthetic && <EmailDispatchPanel batchId={batchId} canManage={Boolean(session?.isAdmin)} reviewEditing={dirty || saving} onChanged={() => { setVersion(value => value + 1); setDetailVersion(value => value + 1); }} />}
    <Pagination currentPage={page} totalPages={Math.ceil((rows?.total ?? 0) / 25)} itemSummary={rows ? `${rows.total} matching drafts · 25 per page` : ''} onPageChange={next => navigate(() => setPage(next))} />
  </PageLayout>;
}
