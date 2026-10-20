'use client';

import { useEffect, useRef, useState } from 'react';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import type { StudioAuthoringEdit, StudioAuthoringView } from '@/lib/designStudio/authoringView';
import { changeStudioSaveSession, createStudioSaveSession, prepareStudioSave, settleStudioSave, type StudioSaveSession } from '@/lib/designStudio/saveSession';
import { acknowledgeStudioCommand, sendStudioCommand, type StudioSaveScope, type StudioPendingCommand } from '@/lib/designStudio/saveTransport';
import { persistStudioWorkingCopy, readStudioWorkingCopy, listStudioRetainedCopies, type StudioRetainedCopy } from '@/lib/designStudio/workingCopy';
import { useSavedStudioDesign, restoreRetainedWebsiteChoices } from '@/lib/designStudio/workingCopyRecovery';
import { registerStudioLifecycle, type StudioLifecycleRegistration } from '@/lib/designStudio/studioLifecycle';

export type StudioEditingSessionProps = { scope: StudioSaveScope; view: StudioAuthoringView; updatedAt: string | null; editable: boolean };
type Status = 'loading' | 'ready' | 'saving' | 'recovery' | 'unavailable' | 'locked';
type Snapshot = { savedMismatch: boolean; retainedCopies: StudioRetainedCopy[]; identity: string; session: StudioSaveSession | null; status: Status; message: string | null; localDurable: boolean; retryOnly: boolean };
type Context = { savedMismatch: boolean; retainedCopies: StudioRetainedCopy[]; lifecycle: StudioLifecycleRegistration | null; retryOnly: boolean; recoveryCommand: StudioPendingCommand | null; serverRevision: number; serverUpdatedAt: string | null; identity: string; scope: StudioSaveScope; live: boolean; blocked: boolean; saving: boolean; session: StudioSaveSession | null; token: string | null; queue: Promise<boolean>; writes: number; durable: boolean; status: Status; message: string | null };

export function useStudioEditingSession(props: StudioEditingSessionProps) {
  // Value identity avoids resetting the editor when callers recreate equivalent DTOs.
  const identity = JSON.stringify(props);
  const context = useRef<Context | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ savedMismatch: false, retainedCopies: [], identity, session: null, status: 'loading', message: null, localDurable: false, retryOnly: false });
  const active = (c: Context) => c.live && context.current === c && Boolean(c.lifecycle?.valid()) && getLocalFirstStoreOwner() === c.scope.actorId;
  const publish = (c: Context) => {
    if (active(c)) setSnapshot({ savedMismatch: c.savedMismatch, retainedCopies: c.retainedCopies, identity: c.identity, session: c.session ? structuredClone(c.session) : null, status: c.status, message: c.message, localDurable: c.durable, retryOnly: c.retryOnly });
  };
  const block = (c: Context, message: string, status: Status = 'recovery') => { c.blocked = true; c.status = status; c.message = message; publish(c); };
  const persist = (c: Context): Promise<boolean> => {
    const value = structuredClone(c.session!);
    c.writes++; c.durable = false; publish(c);
    c.queue = c.queue.then(async previous => {
      // Already accepted edits drain to storage after unmount, while owner changes
      // still stop them. UI updates and network continuation require a live context.
      if (!previous || !c.lifecycle?.valid() || getLocalFirstStoreOwner() !== c.scope.actorId || c.blocked) return false;
      const result = await persistStudioWorkingCopy(c.scope, value, c.token);
      if (!c.lifecycle?.valid() || getLocalFirstStoreOwner() !== c.scope.actorId) return false;
      if (result.state !== 'persisted') { block(c, result.message, result.state === 'unavailable' ? 'unavailable' : 'recovery'); return false; }
      c.token = result.token; c.writes--; c.durable = c.writes === 0; publish(c); return true;
    });
    return c.queue;
  };

  useEffect(() => {
    const input = JSON.parse(identity) as StudioEditingSessionProps;
    const c: Context = { savedMismatch: false, retainedCopies: [], lifecycle: null, retryOnly: false, recoveryCommand: null, serverRevision: input.view.revision, serverUpdatedAt: input.updatedAt, identity, scope: input.scope, live: true, blocked: false, saving: false, session: null, token: null, queue: Promise.resolve(true), writes: 0, durable: false, status: 'loading', message: null };
    context.current = c;
    let restoring = false;
    function requestRestore() {
      if (restoring || !active(c) || !c.lifecycle?.allowed() || c.status !== 'loading') return;
      restoring = true;
      void restore().catch(() => block(c, 'The local design could not be restored. Existing work has been kept.', 'unavailable'))
        .finally(() => { restoring = false; requestRestore(); });
    }
    c.lifecycle = registerStudioLifecycle(c.scope.actorId, async () => {
      const stored = await c.queue;
      return stored && (c.session === null || (c.writes === 0 && c.durable));
    }, () => { publish(c); requestRestore(); });
    publish(c);
    const matchesBase = (state: StudioSaveSession) => state.baseRevision === input.view.revision && state.baseUpdatedAt === input.updatedAt;
    async function restore() {
      if (!active(c) || !c.lifecycle?.allowed()) return;
      if (!input.editable) { block(c, 'This saved version is locked. Create a new revision to edit it.', 'locked'); return; }
      try { c.retainedCopies = await listStudioRetainedCopies(c.scope); }
      catch { c.message = 'A retained copy could not be read. It has not been removed.'; }
      const found = await readStudioWorkingCopy(c.scope);
      if (!active(c) || !c.lifecycle?.allowed()) return;
      if (found.state === 'absent') {
        try { c.session = createStudioSaveSession(c.scope, input.view, input.updatedAt); } catch { block(c, 'The saved design could not be verified.'); return; }
        if (!await persist(c)) return;
      } else if (found.state === 'valid' || found.state === 'recovery') {
        c.session = found.session; c.token = found.token;
        if (!c.session) { block(c, 'Retained saves need reconciliation before this design can be edited.'); return; }
        c.durable = true;
        if (found.state === 'recovery') {
          const entries = found.journal.entries;
          const retained = entries.length === 1 && entries[0].recovery.state === 'valid' ? entries[0].recovery : null;
          const pending = c.session.pending;
          if (retained?.receipt && (pending ? retained.body === JSON.stringify(pending.command) : c.session.baseRevision === retained.receipt.revision && c.session.baseUpdatedAt === retained.receipt.savedAt)) {
            if (input.view.revision !== retained.receipt.revision || input.updatedAt !== retained.receipt.savedAt) { block(c, 'The confirmed save and loaded design differ. Reload the saved design before continuing.'); return; }
            if (pending) { c.session = settleStudioSave(c.session, pending.command.requestId, { kind: 'success', receipt: retained.receipt }); if (!await persist(c)) return;
              if (c.session.pending || c.session.baseRevision !== retained.receipt.revision) { block(c, 'The confirmed save is retained. Reconcile the duplicate source before continuing.'); return; } }
            if (!await acknowledgeStudioCommand(c.scope, retained.command, { body: retained.body, receipt: retained.receipt }) || !active(c)) { block(c, 'The confirmed save is retained. Reload to finish recovery.'); return; }
          } else if (pending && entries.length === 0 && matchesBase(c.session)) {
            // Reload between working-copy persistence and journal staging: keep the exact command.
            c.session = settleStudioSave(c.session, pending.command.requestId, { kind: 'uncertain' });
            if (!await persist(c)) return;
          } else if (retained && !retained.receipt && ![400, 409, 422].includes(retained.rejectedStatus ?? 0) && !pending &&
            [retained.command.expectedRevision, retained.command.expectedRevision + 1].includes(c.session.baseRevision) && matchesBase(c.session)) {
            // Earlier clients settled locally before a receipt could be retained.
            // Replay the journal's exact command; never synthesize a new pending edit.
            c.recoveryCommand = retained.command; c.retryOnly = true;
            c.message = 'Retry the retained request to verify the previous save. Editing is paused.';
          } else { block(c, 'The local design and retained saves need reconciliation. Your work has been kept.'); return; }
        }
        if (!matchesBase(c.session)) {
          if (found.state === 'valid' && c.session.status === 'idle' && !c.session.dirty && !c.session.pending
            && c.session.edit.deletions.length === 0 && !c.session.edit.duplications?.length
            && input.view.revision >= c.session.baseRevision) {
            // A fully acknowledged cache has no local work to reconcile. Replace
            // it through the same CAS boundary so concurrent edits still win.
            c.session = { ...createStudioSaveSession(c.scope, input.view, input.updatedAt), generation: c.session.generation };
            if (!await persist(c)) return;
          } else if (c.session.pending && input.view.revision >= c.session.baseRevision) c.retryOnly = true;
          else { c.savedMismatch = found.state === 'valid' && c.session.status === 'idle' && !c.session.pending && input.view.revision >= c.session.baseRevision; block(c, 'A newer saved design is available. Your unsaved choices are kept.'); return; }
        }
        if (c.session.status === 'conflict' || c.session.status === 'rejected') { block(c, 'The previous save needs reconciliation before editing can continue.'); return; }
        if (c.session.pending) {
          c.session = settleStudioSave(c.session, c.session.pending.command.requestId, { kind: 'uncertain' });
          if (!await persist(c)) return;
          c.message = c.retryOnly ? 'The saved design has advanced. Retry the exact previous request to check its result; editing is paused.' : 'A previous save is unconfirmed. Retry the retained request to check its result.';
        }
      } else { block(c, found.message, found.state === 'unavailable' ? 'unavailable' : 'recovery'); return; }
      if (c.session && (!c.session.baselinePergolaIds || !c.session.baselineObjectOptions) && matchesBase(c.session)) {
        c.session.baselinePergolaIds = input.view.spatial.pergolas.map(p => p.id);
        c.session.baselineObjectOptions = structuredClone(input.view.objectOptions);
        if (!await persist(c)) return;
      }
      c.status = 'ready'; publish(c);
    }
    void c.lifecycle.ready.then(() => {
      if (!navigator.locks?.request) block(c, 'This browser could not protect design editing across tabs. Reload in a browser with Web Locks support.', 'unavailable');
      else requestRestore();
    });
    return () => { c.live = false; c.lifecycle?.detach(); };
    // All inputs are captured in the value identity; helpers operate on that isolated context.
  }, [identity]);

  const change = (edit: StudioAuthoringEdit) => {
    const c = context.current;
    if (!c || !active(c) || !c.lifecycle?.allowed() || c.identity !== identity || c.blocked || c.retryOnly || !c.session || !['ready', 'saving'].includes(c.status)) return;
    try { c.session = changeStudioSaveSession(c.session, edit); c.message = null; void persist(c); }
    catch { block(c, 'This edit could not be validated. Your previous local work has been kept.'); }
  };
  const runSave = async (retry: boolean) => {
    const c = context.current;
    if (!c || !active(c) || !c.lifecycle?.allowed() || c.identity !== identity || c.blocked || c.saving || !c.session || c.status !== 'ready') return;
    if (retry !== Boolean(c.session.pending || c.recoveryCommand) || (!retry && (!c.session.dirty || c.retryOnly))) return;
    c.saving = true; c.status = 'saving'; c.message = null;
    try {
      if (!c.recoveryCommand) c.session = prepareStudioSave(c.session, crypto.randomUUID());
      const command = c.recoveryCommand ?? c.session.pending!.command;
      if (!await persist(c) || !active(c) || !c.lifecycle?.allowed()) return;
      const result = await sendStudioCommand(c.scope, command);
      if (!active(c) || !c.lifecycle?.allowed() || c.blocked || !c.session) return;
      if (result.state === 'confirmed') {
        if ((c.retryOnly && (result.receipt.revision !== c.serverRevision || result.receipt.savedAt !== c.serverUpdatedAt)) ||
          (c.recoveryCommand && (result.receipt.revision !== c.session.baseRevision || result.receipt.savedAt !== c.session.baseUpdatedAt))) {
          block(c, 'The original save was confirmed, but another saved revision differs. Your local work is retained for reconciliation.'); return;
        }
        if (!result.receiptStored) {
          c.session = settleStudioSave(c.session, command.requestId, { kind: 'uncertain' });
          if (!await persist(c) || !active(c)) return;
          c.retryOnly = true; c.serverRevision = result.receipt.revision; c.serverUpdatedAt = result.receipt.savedAt;
          c.status = 'ready'; c.message = 'Saved on the server, but the confirmation could not be retained. Retry the exact request; editing is paused.'; publish(c); return;
        }
        c.session = settleStudioSave(c.session, command.requestId, { kind: 'success', receipt: result.receipt });
        if (!await persist(c) || !active(c)) return;
        if (c.session.pending || c.session.baseRevision !== result.receipt.revision) { block(c, 'The confirmed save is retained. Reconcile the duplicate source before continuing.'); return; }
        if (!await acknowledgeStudioCommand(c.scope, command, { body: result.body, receipt: result.receipt })) {
          block(c, 'Saved on the server. The local confirmation still needs recovery; your work is retained.'); return;
        }
        if (!active(c) || !c.lifecycle?.allowed()) return;
        c.retryOnly = false; c.recoveryCommand = null;
        c.message = c.session.dirty ? 'Saved. Newer changes remain to be saved.' : 'Saved.';
      } else {
        const rejected = result.state === 'rejected';
        c.session = settleStudioSave(c.session, command.requestId, { kind: rejected ? result.status === 409 ? 'conflict' : 'rejected' : 'uncertain' });
        if (!await persist(c) || !active(c)) return;
        c.message = result.message;
        if (rejected || result.state === 'blocked') { block(c, result.message); return; }
      }
      c.status = 'ready'; publish(c);
    } catch { if (active(c)) block(c, 'The save could not be completed safely. Your working copy and request are retained.'); }
    finally {
      c.saving = false;
      if (active(c) && !c.lifecycle?.allowed() && c.session?.pending && !c.blocked) {
        c.status = 'ready'; c.message = 'The request is retained for explicit recovery.'; publish(c);
      }
    }
  };
  const useSaved = async () => {
    const c = context.current;
    if (!c || !active(c) || !c.lifecycle?.allowed() || !props.editable || !c.savedMismatch || c.saving || !c.session || !c.token || c.session.pending) return;
    c.saving = true; publish(c);
    try {
      const result = await useSavedStudioDesign(c.scope, c.token);
      if (!active(c) || !c.lifecycle?.allowed()) return;
      c.session = result.session; c.token = result.token; c.serverRevision = result.session.baseRevision; c.serverUpdatedAt = result.updatedAt;
      c.retainedCopies = [result.retained, ...c.retainedCopies]; c.savedMismatch = false; c.blocked = false; c.retryOnly = false;
      c.queue = Promise.resolve(true); c.writes = 0; c.durable = true; c.status = 'ready'; c.message = null;
    } catch (error) { if (active(c)) c.message = error instanceof Error ? error.message : 'Your retained work is kept; the saved design could not be loaded.'; }
    finally { c.saving = false; publish(c); }
  };
  const restoreChoices = (key: string) => {
    const c = context.current;
    if (!c || !active(c) || !c.lifecycle?.allowed() || c.status !== 'ready' || c.blocked || !c.session || c.session.dirty || c.session.pending) return;
    const retained = c.retainedCopies.find(copy => copy.key === key); if (!retained) return;
    try { change(restoreRetainedWebsiteChoices(c.session.edit, retained)); }
    catch (error) { c.message = error instanceof Error ? error.message : 'The retained choices could not be restored.'; publish(c); }
  };
  const visible = snapshot.identity === identity && getLocalFirstStoreOwner() === props.scope.actorId ? snapshot : { savedMismatch: false, retainedCopies: [], identity, session: null, status: 'loading' as const, message: null, localDurable: false, retryOnly: false };
  const lifecycleAllowed = Boolean(context.current?.lifecycle?.allowed());
  const canEdit = lifecycleAllowed && props.editable && !visible.retryOnly && ['ready', 'saving'].includes(visible.status);
  return { ...visible, edit: visible.session?.edit ?? null, canEdit,
    canSave: lifecycleAllowed && !visible.retryOnly && visible.status === 'ready' && Boolean(visible.session?.dirty) && !visible.session?.pending,
    canRetry: lifecycleAllowed && visible.status === 'ready' && (visible.retryOnly || Boolean(visible.session?.pending)),
    canUseSaved: lifecycleAllowed && props.editable && visible.savedMismatch, canRestoreChoices: canEdit && !visible.session?.dirty && !visible.session?.pending, useSaved, restoreChoices,
    change, save: () => runSave(false), retry: () => runSave(true) };
}
