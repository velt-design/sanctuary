'use client';
import { cloneElement, isValidElement, useContext, useEffect, useId, useRef, useState, type ReactNode, type ComponentProps } from 'react';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import { navigateStudioDocument } from '@/lib/designStudio/studioDocumentNavigation';
import { rememberStudioProjectChoice, studioDesignHref, type StudioProjectDesigns } from '@/lib/designStudio/projectDesigns';
import { studioDesignDate } from '@/lib/designStudio/studioDesignIdentity';
import css from './StudioDesignSelector.module.css';
import StudioDesignHeading from './StudioDesignHeading';
import CommercialInternalNameDialog from '@/components/projects/ProjectPage/tabs/CommercialInternalNameDialog';
import { renameStudioDesign, type StudioRenameRecovery } from '@/lib/designStudio/renameDesign';
import {StudioDocumentContext} from './StudioDocumentContext';

/** Shared across Design, Review and frozen Quote. Summaries never grant editing. */
export default function StudioDesignSelector({ projectId, estimateId, children, renameAvailable = false }: {
  projectId: string; estimateId: string; children: ReactNode; renameAvailable?: boolean;
}) {
  // The heading also renders in isolated/static presenters. Without a real
  // authenticated Portal context it exposes no selector reads or actions.
  const auth = useContext(PortalAuthContext), actorId = auth?.status === 'authenticated' && ['staff', 'admin'].includes(auth.role ?? '') ? auth.user?.id : undefined;
  const frame=useContext(StudioDocumentContext);
  const identity = `${actorId}:${projectId}:${estimateId}`;
  const [open, setOpen] = useState(false), [attempt, refresh] = useState(0);
  const [result, setResult] = useState<{ identity: string; data?: StudioProjectDesigns; error?: string } | null>(null);
  const [pending, setPending] = useState(false), [navigationError, setNavigationError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false), [renamePending, setRenamePending] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState<{identity:string;name:string|null}|null>(null);
  const [renameRecovery,setRenameRecovery] = useState<StudioRenameRecovery|null>(null);
  const recoveryOwner=useRef<StudioRenameRecovery|null>(null);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), lifetime = useRef<AbortController | null>(null), id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(()=>{
    const abort=new AbortController();lifetime.current=abort;setRenameRecovery(null);recoveryOwner.current=null;
    return()=>{abort.abort();recoveryOwner.current?.retire();recoveryOwner.current=null;if(lifetime.current===abort)lifetime.current=null;};
  },[identity]);
  useEffect(() => {
    const abort = new AbortController();
    setResult(null); setPending(false); setNavigationError(null);
    if (actorId) void apiJson<StudioProjectDesigns & { projectId: string }>(`/api/projects/${projectId}/studio`, { signal: abort.signal, cache: 'no-store' }).then(data => {
      if (data.projectId !== projectId || data.project.id !== projectId.slice(5) || data.loadError) throw Error('Wrong project history');
      if (abort.signal.aborted) return;
      setResult({ identity, data });
      if (data.designs.some(design => design.id === estimateId && design.status !== 'archived')) rememberStudioProjectChoice(actorId, projectId, estimateId);
    }).catch(() => { if (!abort.signal.aborted) setResult({ identity, error: 'Design history could not be loaded.' }); });
    return () => abort.abort();
  }, [identity, actorId, projectId, estimateId, attempt]);
  useEffect(() => { setOpen(false); setRenaming(false); setRenamePending(false); setRenameError(null); }, [identity]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const current = result?.identity === identity ? result : null;
  const selected = current?.data?.designs.find(design => design.id === estimateId);
  const canRename = Boolean(actorId && selected?.designId && !pending && !renamePending && !renameRecovery && renameAvailable);
  const heading = actorId && isValidElement<ComponentProps<typeof StudioDesignHeading>>(children) && children.type === StudioDesignHeading
    ? cloneElement(children, { onRename: () => setRenaming(true), renameDisabled: !canRename, ...(confirmedName?.identity===identity ? {identity:{...children.props.identity,projectName:children.props.identity?.projectName??null,internalName:confirmedName.name,createdAt:children.props.identity?.createdAt??null,history:children.props.identity?.history??'working',quoteLabel:children.props.identity?.quoteLabel??null}} : {}) }) : children;
  async function rename(internalName: string | null) {
    const signal = lifetime.current?.signal;
    if (!canRename || !signal || signal.aborted || !actorId || !selected?.designId) return;
    setRenamePending(true); setRenameError(null);
    try {
      const recovery = await renameStudioDesign({ actorId, projectId, estimateId, designId: selected.designId }, internalName, signal, internalName => {
        if(signal.aborted)return;
        setConfirmedName({identity,name:internalName});
        setResult(previous=>previous?.identity===identity&&previous.data?{...previous,data:{...previous.data,designs:previous.data.designs.map(design=>design.id===estimateId?{...design,label:internalName||'Untitled Studio design'}:design)}}:previous);
      },frame?.retainNavigationPreparation?preparation=>frame.retainNavigationPreparation!({actorId,projectId,estimateId,preparation}):undefined);
      if(signal.aborted){recovery.retire();return;}
      recoveryOwner.current=recovery;setRenameRecovery(recovery);
    } catch (error) { if (!signal.aborted) setRenameError(error instanceof Error ? error.message : 'The design could not be renamed. Your name is kept.'); }
    finally { if (!signal.aborted) setRenamePending(false); }
  }
  async function recoverName(leave=false){
    const recovery=recoveryOwner.current,signal=lifetime.current?.signal;if(!recovery||!signal||signal.aborted||renamePending)return;
    setRenamePending(true);setRenameError(null);
    try{await(leave?recovery.leave():recovery.reopen());}catch(error){if(!signal.aborted)setRenameError(error instanceof Error?error.message:'The saved design could not be reopened. Try again.');}
    finally{if(!signal.aborted)setRenamePending(false);}
  }
  async function go(href: string) {
    const signal = lifetime.current?.signal;
    if (pending || renamePending || renameRecovery || !signal || signal.aborted) return;
    setPending(true); setNavigationError(null);
    try { await navigateStudioDocument(href, false, undefined, signal); }
    catch (error) { if (!signal.aborted) setNavigationError(error instanceof Error ? error.message : 'Your changes could not be kept. Please try again.'); }
    finally { if (!signal.aborted) setPending(false); }
  }
  return <div className={css.identity} ref={root} onKeyDown={event => { if (open && event.key === 'Escape') { event.preventDefault(); close(); } }}>
    <div>{heading}</div>
    {actorId && <button className={css.trigger} ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => { setOpen(value => !value); if (!open) refresh(n => n + 1); }}>Designs <span aria-hidden="true">▾</span></button>}
    {open && <section className={css.popover} id={id} aria-label="Design selector and history">
      <div className={css.top}><span>Designs &amp; history</span><button type="button" aria-label="Close design selector" onClick={close}>×</button></div>
      {!current ? <p role="status">Checking design history…</p> : current.error ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => refresh(n => n + 1)}>Retry history</button></div> : <>
        <ul className={css.list}>{current.data!.designs.map(design => <li key={design.id}>
          <a href={studioDesignHref(projectId, design)} aria-current={design.id === estimateId ? 'page' : undefined} aria-disabled={pending || undefined} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (studioDesignHref(projectId, design) === location.pathname + location.search) close(); else void go(studioDesignHref(projectId, design)); }}>
            <span className={css.name}>{design.label}<span>{design.id === estimateId ? '✓' : design.canOpenEditor ? 'Open' : 'Review'}</span></span>
            <small>Design {design.versionLabel} · {design.history}{design.commercialScopeId ? ' · Add-on' : ''}</small>
            <small>{[design.quoteLabel, studioDesignDate(design.createdAt)].filter(Boolean).join(' · ')}</small>
          </a>
        </li>)}</ul>
        <div className={css.footer}><button type="button" disabled={pending || renamePending || !!renameRecovery} onClick={() => void go(`/staff/projects/${projectId}/studio?new=option&requestId=${crypto.randomUUID()}`)}>New option</button><button type="button" disabled={pending || renamePending || !!renameRecovery} onClick={() => void go(`/staff/projects/${projectId}/studio?new=add-on&requestId=${crypto.randomUUID()}`)}>New add-on</button></div>
        {selected && !renameAvailable && <p className={css.hint}>Save the current design before renaming.</p>}
      </>}
      {navigationError && <p role="alert">{navigationError}</p>}
    </section>}
    {renameRecovery&&<div role="alert" className={css.recovery}><p>{renameError||renameRecovery.message}</p><button type="button" disabled={renamePending} onClick={()=>void recoverName()}>Reopen saved design</button><button type="button" disabled={renamePending} onClick={()=>void recoverName(true)}>Back to Project</button></div>}
    <CommercialInternalNameDialog open={renaming} title="Rename design" description={renameError || renameRecovery?.message || 'The design version, pricing and quoted documents stay unchanged.'} initialValue={selected?.label} submitLabel={renameRecovery?'Reopen saved design':'Save name'} pending={renamePending} onClose={() => { setRenaming(false); trigger.current?.focus(); }} onSubmit={renameRecovery?()=>recoverName():rename} />
  </div>;
}
