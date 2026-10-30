'use client';
import {StudioDocumentContext} from './StudioDocumentContext';
import { useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import type { StudioAuthoringResponse } from '@/lib/designStudio/authoringRequest.server';
import { loadStudioEditor } from './studioLeafLoading';
import StudioDesignHeading from './StudioDesignHeading';
import css from './SavedStudioReview.module.css';
import StudioRevisionStart from './StudioRevisionStart';
import StudioCreateAction from './StudioCreateAction';
import {readStudioOpening} from '@/lib/designStudio/studioOpeningTransport';
import type {StudioOpeningPrice} from '@/lib/designStudio/studioOpening';

export default function StudioAuthoringLoader({ projectId, estimateId, intent = 'edit', duplicateName }: { projectId: string; estimateId: string; intent?: 'edit' | 'revision' | 'duplicate'; duplicateName?: string }) {
  const auth = usePortalSession(), actorId = auth.user?.id;
  const identity = `${actorId}:${auth.role}:${projectId}:${estimateId}:${intent}`;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    identity: string; authoring: StudioAuthoringResponse | null;
    Editor?: Awaited<ReturnType<typeof loadStudioEditor>>; leafFailed?: boolean;
    openingPrice?:StudioOpeningPrice;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoaded(null);
    if (!actorId) return () => controller.abort();
    const editor = intent === 'edit' ? loadStudioEditor() : null;
    const path=`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio`;
    const source=intent==='edit'&&(auth.role==='staff'||auth.role==='admin')?readStudioOpening(path,{actorId,role:auth.role,projectId,estimateId},controller.signal):apiJson<{authoring:StudioAuthoringResponse;openingPrice?:StudioOpeningPrice}>(path,{signal:controller.signal});
    void source.then(async ({ authoring,openingPrice }) => {
        if (authoring?.estimate.id !== estimateId || authoring?.estimate.projectId !== projectId) throw Error('Wrong source');
        const needsEditor = intent === 'edit' && authoring.state === 'ready' && authoring.view && !authoring.estimate.requiresNewRevision;
        const Editor = needsEditor ? await editor : null;
        if (!controller.signal.aborted) setLoaded({ identity, authoring, Editor, openingPrice,leafFailed: Boolean(needsEditor && !Editor) });
      }).catch(() => { if (!controller.signal.aborted) setLoaded({ identity, authoring: null }); });
    return () => controller.abort();
  }, [actorId, identity, projectId, estimateId, intent, attempt]);
  const current = loaded?.identity === identity ? loaded : null;
  return <StudioAuthoringContent projectId={projectId} estimateId={estimateId} actorId={actorId} role={auth.role??undefined} intent={intent} duplicateName={duplicateName} loaded={current} retry={()=>setAttempt(value=>value+1)}/>;
}

export type StudioAuthoringLoaded={authoring:StudioAuthoringResponse|null;Editor?:Awaited<ReturnType<typeof loadStudioEditor>>;leafFailed?:boolean;openingPrice?:StudioOpeningPrice};

/** Shared presentation for the protected creation flow and fresh document entry. */
export function StudioAuthoringContent({projectId,estimateId,actorId,role,intent='edit',duplicateName,loaded:current,retry}:{projectId:string;estimateId:string;actorId?:string;role?:string;intent?:'edit'|'revision'|'duplicate';duplicateName?:string;loaded:StudioAuthoringLoaded|null;retry:()=>void}) {
  const prefetch=useContext(StudioDocumentContext)?false:undefined;
  const authoring=current?.authoring;
  const scope = useMemo(() => ({ actorId: actorId ?? '', projectId, estimateId, designId: authoring?.view?.designId ?? '' }), [actorId, projectId, estimateId, authoring?.view?.designId]);
  const identity=JSON.stringify([actorId,role,projectId,estimateId,intent]);
  const Editor = current?.Editor;
  if (Editor && actorId && intent === 'edit' && authoring?.state === 'ready' && authoring.view && !authoring.estimate.requiresNewRevision) return <Editor key={identity} scope={scope} view={authoring.view} updatedAt={authoring.estimate.updatedAt} editable={authoring.nextAction === 'edit'} versionLabel={authoring.estimate.versionLabel} websiteBrief={authoring.websiteBrief} identity={authoring.identity} openingPrice={current?.openingPrice} />;
  return <main className={css.review}><Link prefetch={prefetch} className={css.back} href={`/staff/design-studio/${encodeURIComponent(projectId)}/${encodeURIComponent(estimateId)}`}>← Review estimate</Link>
    <header className={css.header}><StudioDesignHeading identity={authoring?.identity} versionLabel={authoring?.estimate.versionLabel ?? "not loaded"}/></header>
    {!current ? <p role="status">Opening saved design…</p> : current.leafFailed ? <div role="alert"><p>The design editor could not be opened.</p><button className={css.actionLink} onClick={retry}>Try again</button></div> : !authoring ? <><div role="alert"><p>The saved design could not be loaded.</p><button className={css.actionLink} onClick={retry}>Try again</button></div>{actorId && <StudioCreateAction scope={{ actorId, projectId }} intent={{ mode: 'recover', sourceEstimateId: estimateId }} />}</>
      : actorId && authoring.state === 'ready' && authoring.view && (intent !== 'edit' || authoring.estimate.requiresNewRevision) && authoring.estimate.updatedAt
        ? <StudioRevisionStart openOnCreated={intent !== 'duplicate'} key={identity} actorId={actorId} projectId={projectId} estimateId={estimateId} revision={authoring.view.revision} updatedAt={authoring.estimate.updatedAt} duplicateName={intent === 'duplicate' ? duplicateName ?? `Copy of ${authoring.identity?.internalName || `Design ${authoring.estimate.versionLabel}`}` : undefined} />
        : <><p role="status">{authoring.reason ?? 'This version is unavailable for editing.'}</p>{actorId && <StudioCreateAction scope={{ actorId, projectId }} intent={{ mode: 'recover', sourceEstimateId: estimateId }} />}</>}
  </main>;
}
