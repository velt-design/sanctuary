'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import { navigateStudioDocument } from '@/lib/designStudio/studioDocumentNavigation';
import { readStudioProjectChoice, selectStudioProjectDesign, studioDesignHref, type StudioProjectDesigns } from '@/lib/designStudio/projectDesigns';
import StudioCreateAction from './StudioCreateAction';
import css from './SavedStudioReview.module.css';

/** No landing choices: resolve a saved design or create the first default client-side. */
export default function StudioProjectEntry({ projectId, actorId, initial, mode = 'current', creationRequestId }: {
  projectId: string; actorId: string; initial: StudioProjectDesigns; mode?: 'current' | 'option' | 'add-on'; creationRequestId?: string;
}) {
  const auth = usePortalSession();
  const eligible = auth.status === 'authenticated' && auth.user?.id === actorId && ['staff', 'admin'].includes(auth.role ?? '');
  const [state, setState] = useState<{ data: StudioProjectDesigns; create: boolean; error: string | null }>({ data: initial, create: false, error: null });
  const [attempt, retry] = useState(0);
  const live = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController(); live.current = abort;
    setState({ data: initial, create: false, error: null });
    if (!eligible) return () => abort.abort();
    async function open() {
      // Effect replay/retirement must finish before this automatic action takes
      // the shared navigation fence. Explicit user navigation still fences now.
      await Promise.resolve();
      if (abort.signal.aborted) return;
      const data = attempt ? await apiJson<StudioProjectDesigns & { projectId: string }>(`/api/projects/${projectId}/studio`, { signal: abort.signal, cache: 'no-store' }) : initial;
      if (abort.signal.aborted) return;
      if (data.project.id !== projectId.slice(5) || data.loadError) throw Error('Design history could not be checked. Nothing new has been created.');
      const selected = selectStudioProjectDesign(data.designs, readStudioProjectChoice(actorId, projectId));
      if (mode === 'current' && selected) await navigateStudioDocument(studioDesignHref(projectId, selected), true, undefined, abort.signal);
      else setState({ data, create: true, error: null });
    }
    void open().catch(error => { if (!abort.signal.aborted) setState({ data: initial, create: false, error: error instanceof Error ? error.message : 'Studio could not be opened.' }); });
    return () => { abort.abort(); if (live.current === abort) live.current = null; };
  }, [actorId, projectId, eligible, initial, mode, attempt]);

  // Executed by StudioCreateAction under its existing actor/project/intent lock,
  // before staging. A confirmed creation in another tab must win over stale empty UI.
  async function beforeCreate() {
    const signal = live.current?.signal;
    if (!signal || signal.aborted) throw Error('This entry was retired.');
    const data = await apiJson<StudioProjectDesigns & { projectId: string }>(`/api/projects/${projectId}/studio`, { signal, cache: 'no-store' });
    if (signal.aborted || data.projectId !== projectId || data.project.id !== projectId.slice(5) || data.loadError) throw Error('Design history could not be checked.');
    if (mode !== 'current') return true;
    const selected = selectStudioProjectDesign(data.designs, readStudioProjectChoice(actorId, projectId));
    if (!selected) return true;
    await navigateStudioDocument(studioDesignHref(projectId, selected), true, undefined, signal);
    return false;
  }
  return <main className={css.review}>
    <Link className={css.back} href={`/staff/projects/${projectId}`}>Sanctuary · back to project</Link>
    <header className={css.header}><h1>{initial.project.name}</h1></header>
    {!eligible ? <p role="status">Checking your signed-in session…</p> : state.error ? <div role="alert"><p>{state.error}</p><button onClick={() => retry(n => n + 1)}>Try again</button></div> : state.create ?
      <StudioCreateAction key={`${actorId}:${projectId}:${mode}:${creationRequestId}:${attempt}`} scope={{ actorId, projectId }} intent={{ mode: 'blank', scope: mode === 'add-on' ? 'add_on' : 'base', internalName: `${mode === 'add-on' ? 'Add-on' : 'Design'} ${state.data.designs.length + 1}` }} openOnCreated automatic={mode === 'current' ? 'first' : 'new'} creationRequestId={creationRequestId} beforeCreate={beforeCreate} onRetryEntry={() => retry(n => n + 1)} />
      : <p role="status">Opening Design Studio…</p>}
  </main>;
}
