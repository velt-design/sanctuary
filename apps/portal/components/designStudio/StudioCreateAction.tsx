'use client';
import StudioNativeLink from './StudioNativeLink';
import {apiJson} from '@/lib/repo/apiClient';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';
import type {StudioAuthoringResponse} from '@/lib/designStudio/authoringRequest.server';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { acknowledgeStudioCreation, listStudioPendingCreations, sendStudioCreation, stageStudioCreation, type StudioCreateScope, type StudioCreatePendingRead } from '@/lib/designStudio/createTransport';
import type { StudioCreateCommand, StudioCreateReceipt } from '@/lib/designStudio/createCommand';
import { registerStudioLifecycle, type StudioLifecycleRegistration } from '@/lib/designStudio/studioSessionLifecycle';
import styles from './SavedStudioReview.module.css';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { useProjectCommercialContext } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import StudioCommercialPolicy from './StudioCommercialPolicy';

type CreationIntent<Command> = Command extends StudioCreateCommand ? Omit<Command, 'schemaVersion' | 'requestId'> : never;
export type StudioCreateIntent = CreationIntent<StudioCreateCommand> | { mode: 'recover'; sourceEstimateId: string; internalName?: never };
type Pending = Extract<StudioCreatePendingRead, { state: 'valid' }>;
type View = { identity: string; state: 'loading' | 'ready' | 'sending' | 'retry' | 'confirmed' | 'blocked'; command?: StudioCreateCommand; receipt?: StudioCreateReceipt; body?: string; receiptStored?: boolean; opening?:boolean; message?: string };
const matches = (command: StudioCreateCommand, intent: StudioCreateIntent) => command.mode === 'blank' ? intent.mode === 'blank' && command.scope === intent.scope : intent.mode !== 'blank' && command.sourceEstimateId === intent.sourceEstimateId;

export default function StudioCreateAction({ scope, intent, openOnCreated=false }: { scope: StudioCreateScope; intent: StudioCreateIntent; openOnCreated?:boolean }) {
  return <StudioCommercialPolicy actorId={scope.actorId} projectId={scope.projectId}><StudioCreationCommand scope={scope} intent={intent} openOnCreated={openOnCreated} /></StudioCommercialPolicy>;
}

function StudioCreationCommand({ scope, intent, openOnCreated=false }: { scope: StudioCreateScope; intent: StudioCreateIntent; openOnCreated?:boolean }) {
  const commercial = useProjectCommercialContext();
  const actionsAvailable = useRef(commercial.actionsAvailable);
  actionsAvailable.current = commercial.actionsAvailable;
  const router=useRouter(),refreshed=useRef<string|null>(null);
  const queryClient = useQueryClient();
  const identity = JSON.stringify({ scope, intent });
  const [view, setView] = useState<View>({ identity, state: 'loading' });
  const lifecycle = useRef<{ identity: string; live: boolean; busy: boolean; participant: StudioLifecycleRegistration | null; staging: Promise<boolean>; durable: boolean; checking?:AbortController }>({ identity, live: false, busy: false, participant: null, staging: Promise.resolve(true), durable: true });
  useEffect(() => {
    const current: typeof lifecycle.current = { identity, live: true, busy: false, participant: null, staging: Promise.resolve(true), durable: true }; lifecycle.current = current;
    const captured = JSON.parse(identity) as { scope: StudioCreateScope; intent: StudioCreateIntent };
    setView({ identity, state: 'loading' });
    current.participant = registerStudioLifecycle(captured.scope.actorId,
      async () => await current.staging && current.durable,
      () => { if(!current.participant?.allowed())current.checking?.abort();if (current.live) setView(previous => ({ ...previous })); });
    void current.participant.ready.then(ready => {
      if (!ready) throw Error('Coordination unavailable');
      return discover(captured.scope, captured.intent);
    }).then(result => {
      if (current.live && current.participant?.valid() && getLocalFirstStoreOwner() === captured.scope.actorId) setView({ identity, ...result });
    }).catch(() => { if (current.live && current.participant?.valid() && getLocalFirstStoreOwner() === captured.scope.actorId) setView({ identity, state: 'blocked', message: 'Retained creation requests could not be read. Nothing has been created.' }); });
    return () => { current.live = false; current.checking?.abort();current.participant?.detach(); };
  }, [identity]);

  async function discover(boundScope: StudioCreateScope, boundIntent: StudioCreateIntent): Promise<Omit<View, 'identity'>> {
    const found = await listStudioPendingCreations(boundScope);
    if (found.state !== 'available') return { state: 'blocked', message: found.message };
    if (found.entries.some(entry => entry.recovery.state !== 'valid')) return { state: 'blocked', message: 'A retained creation request needs recovery. It has been kept unchanged.' };
    const relevant = found.entries.map(entry => entry.recovery as Pending).filter(entry => matches(entry.command, boundIntent));
    if (relevant.length > 1) return { state: 'blocked', message: 'Multiple creation requests need reconciliation. No new request has been created.' };
    const retained = relevant[0];
    if (!retained) return { state: 'ready' };
    if (retained.receipt) return { state: 'confirmed', command: retained.command, receipt: retained.receipt, body: retained.body, receiptStored: true };
    if (retained.rejectedStatus !== null) return { state: 'blocked', command: retained.command, message: 'The previous creation request was rejected. Its details are retained for reconciliation.' };
    return { state: 'retry', command: retained.command, message: 'A previous creation is unconfirmed. Retry the exact request to check its result.' };
  }

  async function run() {
    const current = lifecycle.current;
    if (!actionsAvailable.current || !current.live || !current.participant?.allowed() || current.identity !== identity || current.busy || getLocalFirstStoreOwner() !== scope.actorId || !['ready', 'retry'].includes(view.state) || (intent.mode === 'recover' && view.state !== 'retry')) return;
    const boundScope = structuredClone(scope), boundIntent = structuredClone(intent);
    const valid = () => current.live && lifecycle.current === current && Boolean(current.participant?.allowed()) && getLocalFirstStoreOwner() === boundScope.actorId;
    current.busy = true; setView(previous => ({ ...previous, state: 'sending' }));
    try {
      if (!navigator.locks?.request) { if (valid()) setView({ identity, state: 'blocked', message: 'This browser cannot safely coordinate creation requests. Use a browser with Web Locks support.' }); return; }
      const intentKey = boundIntent.mode === 'blank' ? `blank:${boundIntent.scope}` : `clone:${boundIntent.sourceEstimateId}`;
      await navigator.locks.request(`sanctuary-studio-create:${boundScope.actorId}:${boundScope.projectId}:${intentKey}`, async () => {
        if (!valid()) return;
        // Re-discover inside the browser lock so another tab cannot create a
        // second request for the same intent after an initially empty discovery.
        const found = await discover(boundScope, boundIntent);
        if (!valid()) return;
        if (!actionsAvailable.current) { setView({ identity, ...found }); return; }
        if (found.state !== 'ready' && found.state !== 'retry') { setView({ identity, ...found }); return; }
        if (found.state === 'retry' && (view.state !== 'retry' || view.command?.requestId !== found.command?.requestId)) { setView({ identity, ...found }); return; }
        if (found.state === 'ready' && view.state === 'retry') { setView({ identity, state: 'blocked', message: 'The retained request changed. Reload to reconcile it before creating anything else.' }); return; }
        let command = found.command;
        if (!command) {
          if (boundIntent.mode === 'recover') return;
          command = boundIntent.mode === 'website'
            ? 'hostSource' in boundIntent
              ? { ...boundIntent, schemaVersion: 'studio_create.v4', requestId: crypto.randomUUID() }
              : 'family' in boundIntent.enrichment
              ? { ...boundIntent, enrichment: boundIntent.enrichment, schemaVersion: 'studio_create.v3', requestId: crypto.randomUUID() }
              : { ...boundIntent, enrichment: boundIntent.enrichment, schemaVersion: 'studio_create.v2', requestId: crypto.randomUUID() }
            : { schemaVersion: 'studio_create.v1', requestId: crypto.randomUUID(), ...boundIntent };
        }
        setView({ identity, state: 'sending', command });
        current.durable = false;
        current.staging = stageStudioCreation(boundScope, command).then(staged => {
          current.durable = staged.state === 'valid'; return current.durable;
        });
        if (!await current.staging) throw Error('Request could not be retained');
        if (!valid()) {
          if (current.live && current.participant?.valid()) setView({ identity, state: 'retry', command, message: 'The request is retained. Retry explicitly to check its result.' });
          return;
        }
        if (!actionsAvailable.current) {
          setView({ identity, state: 'retry', command, message: 'The request is retained. Review the current project state before retrying.' });
          return;
        }
        const result = await sendStudioCreation(boundScope, command,valid);
        if (!valid()) return;
        if (result.state === 'confirmed') setView({ identity, state: 'confirmed', command, receipt: result.receipt, body: result.body, receiptStored: result.receiptStored, opening:openOnCreated&&result.receiptStored,
          ...(!result.receiptStored ? { message: 'Created. The request is retained because the browser could not store its confirmation.' } : {}) });
        else setView({ identity, state: result.state === 'unconfirmed' ? 'retry' : 'blocked', command, message: result.message });
        if(openOnCreated&&result.state==='confirmed'&&result.receiptStored&&valid()){
          const target=result.receipt.estimateId,checking=new AbortController();current.checking=checking;const timer=setTimeout(()=>checking.abort(),15000);
          const retained=()=>current.live&&lifecycle.current===current&&Boolean(current.participant?.valid())&&getLocalFirstStoreOwner()===boundScope.actorId;
          try {
            const {authoring}=await apiJson<{authoring:StudioAuthoringResponse}>(`/api/projects/${boundScope.projectId}/estimates/${target}/studio`,{signal:checking.signal});
            if(!valid()||!actionsAvailable.current){if(retained())setView(previous=>({...previous,opening:false,message:'Your revision is created and kept. Open it when the current project state is ready.'}));return;}
            if(authoring.estimate.id!==target||authoring.estimate.projectId!==boundScope.projectId)throw Error('Wrong created design');
            if(authoring.nextAction==='edit'&&!authoring.estimate.requiresNewRevision) await navigateStudioDocument(`/staff/design-studio/${boundScope.projectId}/${target}/edit`);
            else router.push(`/staff/design-studio/${boundScope.projectId}/${target}`);
          }catch{if(retained())setView(previous=>({...previous,opening:false,message:'The revision is created and kept. Open the design to continue.'}));}finally{clearTimeout(timer);if(current.checking===checking)current.checking=undefined;}
        }
      });
    } catch { if (valid()) setView({ identity, state: 'blocked', message: 'Creation could not be confirmed. Retained requests have been kept for recovery.' }); }
    finally {
      current.busy = false;
      if (current.live && current.participant?.valid() && !current.participant.allowed()) setView(previous =>
        previous.state === 'sending' && previous.command ? { ...previous, state: 'retry', message: 'The request is retained for explicit recovery.' } : previous);
    }
  }
  async function startAnother() {
    const current = lifecycle.current;
    if (!actionsAvailable.current || intent.mode === 'recover' || !current.live || !current.participant?.allowed() || current.identity !== identity || current.busy || view.state !== 'confirmed' || !view.receiptStored || !view.command || !view.receipt || !view.body || getLocalFirstStoreOwner() !== scope.actorId) return;
    const confirmation = { command: structuredClone(view.command), receipt: structuredClone(view.receipt), body: view.body };
    const boundScope = structuredClone(scope), boundIntent = structuredClone(intent);
    const valid = () => current.live && lifecycle.current === current && Boolean(current.participant?.allowed()) && getLocalFirstStoreOwner() === boundScope.actorId;
    current.busy = true;
    try {
      if (!navigator.locks?.request) throw Error();
      const intentKey = boundIntent.mode === 'blank' ? `blank:${boundIntent.scope}` : `clone:${boundIntent.sourceEstimateId}`;
      await navigator.locks.request(`sanctuary-studio-create:${boundScope.actorId}:${boundScope.projectId}:${intentKey}`, async () => {
        if (!valid() || !actionsAvailable.current) return;
        const acknowledged = await acknowledgeStudioCreation(boundScope, confirmation.command, { body: confirmation.body, receipt: confirmation.receipt });
        if (!valid()) return;
        if (!acknowledged) throw Error();
        const next = await discover(boundScope, boundIntent);
        if (valid()) setView({ identity, ...next });
      });
    } catch { if (valid()) setView(previous => ({ ...previous, message: 'The saved confirmation could not be cleared safely. Open the existing design or reload to reconcile it.' })); }
    finally {
      current.busy = false;
      if (current.live && current.participant?.valid() && !current.participant.allowed()) setView(previous =>
        previous.state === 'sending' && previous.command ? { ...previous, state: 'retry', message: 'The request is retained for explicit recovery.' } : previous);
    }
  }
  const lifecycleAllowed = Boolean(lifecycle.current.participant?.allowed());
  const current = view.identity === identity && getLocalFirstStoreOwner() === scope.actorId ? view : { identity, state: 'loading' as const };
  useEffect(() => {
    if (view.identity !== identity || view.state !== 'confirmed' || getLocalFirstStoreOwner() !== scope.actorId) return;
    const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
    void queryClient.invalidateQueries({ queryKey: qk.estimates.metaByProject(host, scope.projectId) });
  }, [identity, queryClient, scope.actorId, scope.projectId, view.identity, view.state]);
  useEffect(()=>{if(!openOnCreated&&current.state==='confirmed'&&current.receiptStored&&current.receipt&&refreshed.current!==current.receipt.estimateId){refreshed.current=current.receipt.estimateId;router.refresh();}},[current,router,openOnCreated]);
  if (intent.mode === 'recover' && current.state === 'ready') return null;
  return <div aria-busy={current.state === 'loading' || current.state === 'sending'}>
    {current.command?.mode === 'website' && <section aria-label="Retained website import details">
      <p role="status">This saved request uses the details below. Retrying keeps these details, including when the form above has changed.</p>
      <dl>
        <dt>{current.command.schemaVersion === 'studio_create.v3' ? 'Eave underside height (m)' : 'High-side support height (m)'}</dt><dd>{current.command.enrichment.heightM}</dd>
        <dt>Roof pitch (degrees)</dt><dd>{current.command.enrichment.pitchDeg}</dd>
        <dt>Post count</dt><dd>{current.command.enrichment.postCount}</dd>
        <dt>Post connection</dt><dd>{{slab_anchors:'Slab anchors',deck_bracket:'Deck bracket',pile_1m:'1 m pile',pile_1_5m:'1.5 m pile'}[current.command.enrichment.postConnectionType]}</dd>
        <dt>Ground condition</dt><dd>{current.command.enrichment.ground === 'easy' ? 'Easy' : 'Hard'}</dd>
        {current.command.schemaVersion === 'studio_create.v4'
          ? <><dt>Ledger profile</dt><dd>{current.command.enrichment.ledgerProfile}</dd></>
          : <><dt>{current.command.schemaVersion === 'studio_create.v3' ? 'Eave support profile' : 'Front beam profile'}</dt><dd>{current.command.enrichment.frontBeamProfile}</dd></>}
        <dt>Rafter profile</dt><dd>{current.command.enrichment.rafterProfile}</dd>
        <dt>Post profile</dt><dd>{current.command.enrichment.postProfile}</dd>
        {current.command.schemaVersion === 'studio_create.v4' && <>
          <dt>House source estimate</dt><dd>{current.command.hostSource.estimateId}</dd>
          <dt>House source revision</dt><dd>{current.command.hostSource.expectedRevision}</dd>
          <dt>House</dt><dd>{current.command.hostSource.houseFormId}</dd>
          <dt>Wall</dt><dd>{current.command.hostSource.wallId}</dd>
          <dt>Horizontal position (mm)</dt><dd>{current.command.enrichment.position.originXMm}</dd>
          <dt>Vertical position (mm)</dt><dd>{current.command.enrichment.position.originYMm}</dd>
          <dt>Rotation (degrees)</dt><dd>{current.command.enrichment.position.rotationDeg}</dd>
          <dt>Pergola connection edge</dt><dd>{current.command.enrichment.myEdgeIndex}</dd>
          <dt>Staff confirmation</dt><dd>Facade connection confirmed; house geometry reviewed</dd>
        </>}
        {current.command.schemaVersion === 'studio_create.v3' && <>
          <dt>Ridge beam profile</dt><dd>{current.command.enrichment.ridgeBeamProfile}</dd>
          <dt>End frames</dt><dd>{current.command.enrichment.endFramesMode === 'both_ends' ? 'Both ends' : 'None'}</dd>
          {current.command.enrichment.endFramesMode === 'both_ends' && <><dt>Tie beam profile</dt><dd>{current.command.enrichment.tieBeamProfile}</dd><dt>Strut profile</dt><dd>{current.command.enrichment.strutProfile}</dd></>}
          <dt>Reference-side gutter</dt><dd>Integrated</dd><dt>Other-side gutter</dt><dd>Integrated</dd>
        </>}
      </dl>
    </section>}
    {intent.mode !== 'recover' && current.command && ((current.command.internalName ?? null) !== (intent.internalName ?? null) || (current.command.mode !== 'blank' && Object.hasOwn(current.command, 'internalName') !== Object.hasOwn(intent, 'internalName'))) && <p role="status">Retained request: {current.command.mode !== 'blank' && !Object.hasOwn(current.command, 'internalName') ? 'Original source name' : current.command.internalName ?? 'Unnamed design'}. Open or retry this request before creating another.</p>}
    {current.message && <p role={current.state === 'blocked' ? 'alert' : 'status'}>{current.message}</p>}
    {current.state === 'loading' ? <p role="status">Checking retained requests…</p>
      : current.state === 'confirmed' && current.receipt ? current.opening?<p role="status">Opening your new revision…</p>:<><StudioNativeLink className={styles.actionLink} href={`/staff/design-studio/${encodeURIComponent(scope.projectId)}/${encodeURIComponent(current.receipt.estimateId)}${openOnCreated?'':'/edit'}`}>{openOnCreated?'View created revision':'Open design'}</StudioNativeLink>
        {current.receiptStored && intent.mode !== 'recover' && !openOnCreated && <button type="button" disabled={!lifecycleAllowed || !commercial.actionsAvailable} style={{ display: 'block', marginTop: 16 }} onClick={() => { void startAnother(); }}>{intent.mode === 'blank' ? 'Create another design' : 'Start another revision'}</button>}</>
        : current.state !== 'blocked' && <button className={styles.actionLink} type="button" disabled={!lifecycleAllowed || !commercial.actionsAvailable || current.state === 'sending'} onClick={() => { void run(); }}>{current.state === 'sending' ? 'Creating…' : current.state === 'retry' ? 'Retry creation' : intent.mode === 'import' || intent.mode === 'website' ? 'Import as new design' : intent.mode === 'clone' ? openOnCreated ? 'Edit a new revision' : 'Create new revision' : 'Create design'}</button>}
  </div>;
}
