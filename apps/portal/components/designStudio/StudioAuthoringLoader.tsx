'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import type { StudioAuthoringResponse } from '@/lib/designStudio/authoringRequest.server';
import { loadStudioEditor } from './studioLeafLoading';
import StudioDesignHeading from './StudioDesignHeading';
import css from './SavedStudioReview.module.css';
import StudioRevisionStart from './StudioRevisionStart';
import StudioCreateAction from './StudioCreateAction';

export default function StudioAuthoringLoader({ projectId, estimateId, intent = 'edit', duplicateName }: { projectId: string; estimateId: string; intent?: 'edit' | 'revision' | 'duplicate'; duplicateName?: string }) {
  const auth = usePortalSession(), actorId = auth.user?.id;
  const identity = `${actorId}:${auth.role}:${projectId}:${estimateId}:${intent}`;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    identity: string; authoring: StudioAuthoringResponse | null;
    Editor?: Awaited<ReturnType<typeof loadStudioEditor>>; leafFailed?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoaded(null);
    if (!actorId) return () => controller.abort();
    const editor = intent === 'edit' ? loadStudioEditor() : null;
    void apiJson<{ authoring: StudioAuthoringResponse }>(`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio`, { signal: controller.signal })
      .then(async ({ authoring }) => {
        if (authoring?.estimate.id !== estimateId || authoring?.estimate.projectId !== projectId) throw Error('Wrong source');
        const needsEditor = intent === 'edit' && authoring.state === 'ready' && authoring.view && !authoring.estimate.requiresNewRevision;
        const Editor = needsEditor ? await editor : null;
        if (!controller.signal.aborted) setLoaded({ identity, authoring, Editor, leafFailed: Boolean(needsEditor && !Editor) });
      }).catch(() => { if (!controller.signal.aborted) setLoaded({ identity, authoring: null }); });
    return () => controller.abort();
  }, [actorId, identity, projectId, estimateId, intent, attempt]);
  const current = loaded?.identity === identity ? loaded : null, authoring = current?.authoring;
  const scope = useMemo(() => ({ actorId: actorId ?? '', projectId, estimateId, designId: authoring?.view?.designId ?? '' }), [actorId, projectId, estimateId, authoring?.view?.designId]);
  const Editor = current?.Editor;
  if (Editor && actorId && intent === 'edit' && authoring?.state === 'ready' && authoring.view && !authoring.estimate.requiresNewRevision) return <Editor key={identity} scope={scope} view={authoring.view} updatedAt={authoring.estimate.updatedAt} editable={authoring.nextAction === 'edit'} versionLabel={authoring.estimate.versionLabel} websiteBrief={authoring.websiteBrief} identity={authoring.identity} />;
  return <main className={css.review}><Link className={css.back} href={`/staff/design-studio/${encodeURIComponent(projectId)}/${encodeURIComponent(estimateId)}`}>← Review estimate</Link>
    <header className={css.header}><StudioDesignHeading identity={authoring?.identity} versionLabel={authoring?.estimate.versionLabel ?? "not loaded"}/></header>
    {!current ? <p role="status">Opening saved design…</p> : current.leafFailed ? <div role="alert"><p>The design editor could not be opened.</p><button className={css.actionLink} onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : !authoring ? <><div role="alert"><p>The saved design could not be loaded.</p><button className={css.actionLink} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>{actorId && <StudioCreateAction scope={{ actorId, projectId }} intent={{ mode: 'recover', sourceEstimateId: estimateId }} />}</>
      : actorId && authoring.state === 'ready' && authoring.view && (intent !== 'edit' || authoring.estimate.requiresNewRevision) && authoring.estimate.updatedAt
        ? <StudioRevisionStart key={identity} actorId={actorId} projectId={projectId} estimateId={estimateId} revision={authoring.view.revision} updatedAt={authoring.estimate.updatedAt} duplicateName={intent === 'duplicate' ? duplicateName ?? `Copy of ${authoring.identity?.internalName || `Design ${authoring.estimate.versionLabel}`}` : undefined} />
        : <><p role="status">{authoring.reason ?? 'This version is unavailable for editing.'}</p>{actorId && <StudioCreateAction scope={{ actorId, projectId }} intent={{ mode: 'recover', sourceEstimateId: estimateId }} />}</>}
  </main>;
}
