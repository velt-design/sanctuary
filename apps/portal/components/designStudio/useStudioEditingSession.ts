"use client";

import { useEffect, useRef, useState } from "react";
import { getLocalFirstStoreOwner } from "@/lib/localFirst/store";
import type {
  StudioAuthoringEdit,
  StudioAuthoringView,
} from "@/lib/designStudio/authoringView";
import {
  changeStudioSaveSession,
  rebaseStudioUndoEdit,
  createStudioSaveSession,
  prepareStudioSave,
  settleStudioSave,
  reconcileStudioSaveBaseline,
  reconcileStudioConfirmedCommand,
  navigateStudioSaveHistory,
  type StudioSaveSession,
} from "@/lib/designStudio/saveSession";
import type { StudioHistoryChange } from "@/lib/designStudio/editHistory";
import {
  acknowledgeStudioCommand,
  stageStudioCommand,
  recordStudioCommandReceipt,
  listStudioPendingCommands,
  sendStudioCommand,
  type StudioSaveScope,
  type StudioPendingCommand,
} from "@/lib/designStudio/saveTransport";
import {
  canUseSavedStudioWorkingCopy,
  persistStudioWorkingCopy,
  readStudioWorkingCopy,
  listStudioRetainedCopies,
  type StudioRetainedCopy,
} from "@/lib/designStudio/workingCopy";
import {
  useSavedStudioDesign,
  restoreRetainedWebsiteChoices,
} from "@/lib/designStudio/workingCopyRecovery";
import {
  registerStudioLifecycle,
  type StudioLifecycleRegistration,
} from "@/lib/designStudio/studioSessionLifecycle";
import {
  sameStudioAuthoredIdentity,
  type StudioAuthoredIdentity,
  type StudioChangeOutcome,
} from "@/lib/designStudio/interaction/contracts";

export type StudioEditingSessionProps = {
  scope: StudioSaveScope;
  view: StudioAuthoringView;
  updatedAt: string | null;
  editable: boolean;
};
type Status =
  | "loading"
  | "ready"
  | "saving"
  | "recovery"
  | "unavailable"
  | "locked";
type Snapshot = {
  epoch: string;
  savedMismatch: boolean;
  retainedCopies: StudioRetainedCopy[];
  identity: string;
  session: StudioSaveSession | null;
  status: Status;
  message: string | null;
  localDurable: boolean;
  retryOnly: boolean;
};
type Context = {
  historyGroup?: string;
  epoch: string;
  savedMismatch: boolean;
  retainedCopies: StudioRetainedCopy[];
  lifecycle: StudioLifecycleRegistration | null;
  retryOnly: boolean;
  recoveryCommand: StudioPendingCommand | null;
  serverRevision: number;
  serverUpdatedAt: string | null;
  identity: string;
  scope: StudioSaveScope;
  live: boolean;
  blocked: boolean;
  saving: boolean;
  quoteInFlight?:boolean;
  quoteRecoveryCommand?:StudioPendingCommand;
  activeQuoteCommand?:StudioPendingCommand;
  quoteReceipt?:import('@/lib/designStudio/saveTransport').StudioSaveReceipt;
  session: StudioSaveSession | null;
  token: string | null;
  queue: Promise<boolean>;
  writes: number;
  durable: boolean;
  status: Status;
  message: string | null;
  localPersistFault: { status: Status; message: string | null } | null;
};

export function useStudioEditingSession(props: StudioEditingSessionProps) {
  // Value identity avoids resetting the editor when callers recreate equivalent DTOs.
  const identity = JSON.stringify(props);
  const context = useRef<Context | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    epoch: "",
    savedMismatch: false,
    retainedCopies: [],
    identity,
    session: null,
    status: "loading",
    message: null,
    localDurable: false,
    retryOnly: false,
  });
  const active = (c: Context) =>
    c.live &&
    context.current === c &&
    Boolean(c.lifecycle?.valid()) &&
    getLocalFirstStoreOwner() === c.scope.actorId;
  const publish = (c: Context) => {
    if (active(c))
      setSnapshot({
        epoch: c.epoch,
        savedMismatch: c.savedMismatch,
        retainedCopies: c.retainedCopies,
        identity: c.identity,
        session: c.session ? structuredClone(c.session) : null,
        status: c.status,
        message: c.message,
        localDurable: c.durable,
        retryOnly: c.retryOnly,
      });
  };
  const block = (c: Context, message: string, status: Status = "recovery") => {
    // Only an explicit failed write may be retried by a local navigation drain.
    // Restore, role, conflict and reconciliation failures must retain recovery.
    c.localPersistFault = null;
    c.blocked = true;
    c.status = status;
    c.message = message;
    publish(c);
  };
  const persist = (c: Context): Promise<boolean> => {
    const value = structuredClone(c.session!);
    c.writes++;
    c.durable = false;
    publish(c);
    c.queue = c.queue.then(async (previous) => {
      // Already accepted edits drain to storage after unmount, while owner changes
      // still stop them. UI updates and network continuation require a live context.
      if (
        !previous ||
        !c.lifecycle?.valid() ||
        getLocalFirstStoreOwner() !== c.scope.actorId ||
        c.blocked
      )
        return false;
      const result = await persistStudioWorkingCopy(c.scope, value, c.token);
      if (
        !c.lifecycle?.valid() ||
        getLocalFirstStoreOwner() !== c.scope.actorId
      )
        return false;
      if (result.state !== "persisted") {
        const resume = { status: c.status, message: c.message };
        block(
          c,
          result.message,
          result.state === "unavailable" ? "unavailable" : "recovery",
        );
        if (result.state === "unavailable") c.localPersistFault = resume;
        if (result.state === "conflict") {
          const current = await readStudioWorkingCopy(c.scope);
          if (active(c) && c.session) {
            c.savedMismatch = canUseSavedStudioWorkingCopy(current, c.session);
            publish(c);
          }
        }
        return false;
      }
      c.token = result.token;
      c.writes--;
      c.durable = c.writes === 0;
      publish(c);
      return true;
    });
    return c.queue;
  };
  const ownsAcceptedWrites = (c: Context) =>
    Boolean(c.lifecycle?.valid()) && getLocalFirstStoreOwner() === c.scope.actorId;
  const flushAcceptedLocal = async (c: Context): Promise<boolean> => {
    let retried = false;
    for (;;) {
      if (!ownsAcceptedWrites(c)) return false;
      const queued = c.queue;
      const stored = await queued;
      if (!ownsAcceptedWrites(c)) return false;
      if (queued !== c.queue) continue;
      if (stored) return c.session === null ? !c.blocked : c.writes === 0 && c.durable;
      const fault = c.localPersistFault;
      if (retried || !fault || !c.session) return false;
      retried = true;
      // Install this continuation before yielding, so another drain joins the
      // same CAS rather than racing it. Accepted snapshots can outlive the UI.
      c.queue = queued.then(async () => {
        if (!ownsAcceptedWrites(c) || c.localPersistFault !== fault || !c.session) return false;
        const value = structuredClone(c.session);
        const writes = c.writes;
        const result = await persistStudioWorkingCopy(c.scope, value, c.token);
        if (!ownsAcceptedWrites(c)) return false;
        if (result.state !== "persisted") {
          block(c, result.message, result.state === "unavailable" ? "unavailable" : "recovery");
          if (result.state === "unavailable") c.localPersistFault = fault;
          if (result.state === "conflict") {
            const current = await readStudioWorkingCopy(c.scope);
            if (active(c) && c.session) {
              c.savedMismatch = canUseSavedStudioWorkingCopy(current, c.session);
              publish(c);
            }
          }
          return false;
        }
        c.token = result.token;
        c.writes -= writes;
        c.durable = c.writes === 0;
        // A different recovery cause must never be cleared by an older write.
        if (c.localPersistFault === fault) {
          c.localPersistFault = null;
          // Storage recovery cannot finish an interrupted Save/receipt flow.
          // Its existing journal is reconciled on the next fresh opening.
          c.blocked = fault.status === "saving";
          c.status = c.blocked ? "recovery" : fault.status;
          c.message = c.blocked
            ? "The request and latest local changes are retained. Reload this design to reconcile its save confirmation."
            : fault.message;
        }
        publish(c);
        return c.localPersistFault === null;
      });
    }
  };

  useEffect(() => {
    const input = JSON.parse(identity) as StudioEditingSessionProps;
    const c: Context = {
      epoch: crypto.randomUUID(),
      savedMismatch: false,
      retainedCopies: [],
      lifecycle: null,
      retryOnly: false,
      recoveryCommand: null,
      serverRevision: input.view.revision,
      serverUpdatedAt: input.updatedAt,
      identity,
      scope: input.scope,
      live: true,
      blocked: false,
      saving: false,
      session: null,
      token: null,
      queue: Promise.resolve(true),
      writes: 0,
      durable: false,
      status: "loading",
      message: null,
      localPersistFault: null,
    };
    context.current = c;
    let restoring = false;
    function requestRestore() {
      if (
        restoring ||
        !active(c) ||
        !c.lifecycle?.allowed() ||
        c.status !== "loading"
      )
        return;
      restoring = true;
      void restore()
        .catch(() =>
          block(
            c,
            "The local design could not be restored. Existing work has been kept.",
            "unavailable",
          ),
        )
        .finally(() => {
          restoring = false;
          requestRestore();
        });
    }
    c.lifecycle = registerStudioLifecycle(
      c.scope.actorId,
      () => flushAcceptedLocal(c),
      () => {
        publish(c);
        requestRestore();
      },
    );
    publish(c);
    const matchesBase = (state: StudioSaveSession) =>
      state.baseRevision === input.view.revision &&
      state.baseUpdatedAt === input.updatedAt;
    function verifyLoadedBaseline(state: StudioSaveSession) {
      try {
        return matchesBase(state)
          ? reconcileStudioSaveBaseline(state, input.view, input.updatedAt, Boolean(c.recoveryCommand))
          : state;
      } catch (error) {
        block(c, error instanceof Error ? error.message : "The saved baseline could not be verified. Your work is kept.");
        return null;
      }
    }
    async function restore() {
      if (!active(c) || !c.lifecycle?.allowed()) return;
      try {
        c.retainedCopies = await listStudioRetainedCopies(c.scope);
      } catch {
        c.message =
          "A retained copy could not be read. It has not been removed.";
      }
      const found = await readStudioWorkingCopy(c.scope);
      if (!active(c) || !c.lifecycle?.allowed()) return;
      const journal=await listStudioPendingCommands(c.scope);
      if(!active(c)||!c.lifecycle?.allowed())return;
      const quotes=journal.state==='available'?journal.entries.filter(entry=>entry.recovery.state==='valid'&&entry.recovery.operation==='quote_create.v1'):[];
      if(quotes.length){
        const retained=quotes.length===1&&quotes[0].recovery.state==='valid'?quotes[0].recovery:null;
        if(!retained||journal.state!=='available'||journal.entries.length!==1||!['valid','recovery','absent'].includes(found.state)){
          block(c,'The retained quote request and local work need reconciliation. Both are kept.');return;
        }
        if(found.state==='valid'||found.state==='recovery'){
          c.session=found.session;c.token=found.token;c.durable=true;
          if(!c.session||(c.session.pending&&(c.session.pending.operation!=='quote_create.v1'||JSON.stringify(c.session.pending.command)!==retained.body))){block(c,'Different retained operations need reconciliation. Neither request was sent.');return;}
          if(c.session.dirty&&!c.session.pending){block(c,'Newer local changes and the earlier quote request are both kept. Reconcile the newer changes before retrying that quote.');return;}
        }else{
          c.session=createStudioSaveSession(c.scope,input.view,input.updatedAt);
          if(!(await persist(c)))return;
        }
        c.quoteRecoveryCommand=retained.command;c.quoteReceipt=retained.receipt??undefined;c.retryOnly=true;
        c.status='ready';c.message='A previous quote request is unconfirmed. Retry the same quote request to open its saved PDF.';publish(c);return;
      }
      if(!input.editable){block(c,'This saved version is locked. Create a new revision to edit it.','locked');return;}
      if (found.state === "absent") {
        try {
          c.session = createStudioSaveSession(
            c.scope,
            input.view,
            input.updatedAt,
          );
        } catch {
          block(c, "The saved design could not be verified.");
          return;
        }
        if (!(await persist(c))) return;
      } else if (found.state === "valid" || found.state === "recovery") {
        c.session = found.session;
        c.token = found.token;
        if (!c.session) {
          block(
            c,
            "Retained saves need reconciliation before this design can be edited.",
          );
          return;
        }
        c.durable = true;
        if (found.state === "recovery") {
          if (canUseSavedStudioWorkingCopy(found)) {
            c.savedMismatch = true;
            block(c, "The previous save was rejected. Use the saved design to continue; your local choices will be kept.");
            return;
          }
          const entries = found.journal.entries;
          const retained =
            entries.length === 1 && entries[0].recovery.state === "valid"
              ? entries[0].recovery
              : null;
          const pending = c.session.pending;
          if (
            retained?.receipt &&
            (pending
              ? retained.body === JSON.stringify(pending.command)
              : c.session.baseRevision === retained.receipt.revision &&
                c.session.baseUpdatedAt === retained.receipt.savedAt)
          ) {
            if (
              input.view.revision !== retained.receipt.revision ||
              input.updatedAt !== retained.receipt.savedAt
            ) {
              block(
                c,
                "The confirmed save and loaded design differ. Reload the saved design before continuing.",
              );
              return;
            }
            if (pending) {
              const settled = settleStudioSave(
                c.session,
                pending.command.requestId,
                { kind: "success", receipt: retained.receipt },
              );
              if (
                settled.pending ||
                settled.baseRevision !== retained.receipt.revision
              ) {
                block(
                  c,
                  "The confirmed save is retained. Reconcile the duplicate source before continuing.",
                );
                return;
              }
              const verified = verifyLoadedBaseline(settled);
              if (!verified) return;
              c.session = verified;
              if (!(await persist(c))) return;
            } else {
              let confirmed: StudioSaveSession;
              try {
                confirmed = reconcileStudioConfirmedCommand(c.session, retained.command, retained.receipt);
              } catch (error) {
                block(c, error instanceof Error ? error.message : "The confirmed save baseline could not be verified.");
                return;
              }
              const verified = verifyLoadedBaseline(confirmed);
              if (!verified) return;
              c.session = verified;
              if (!(await persist(c))) return;
            }
            if (
              !(await acknowledgeStudioCommand(c.scope, retained.command, {
                body: retained.body,
                receipt: retained.receipt,
              })) ||
              !active(c)
            ) {
              block(
                c,
                "The confirmed save is retained. Reload to finish recovery.",
              );
              return;
            }
          } else if (
            pending &&
            entries.length === 0 &&
            matchesBase(c.session)
          ) {
            // Reload between working-copy persistence and journal staging: keep the exact command.
            const verified = verifyLoadedBaseline(c.session);
            if (!verified) return;
            c.session = settleStudioSave(verified, pending.command.requestId, {
              kind: "uncertain",
            });
            if (!(await persist(c))) return;
          } else if (
            retained &&
            !retained.receipt &&
            ![400, 409, 422].includes(retained.rejectedStatus ?? 0) &&
            !pending &&
            [
              retained.command.expectedRevision,
              retained.command.expectedRevision + 1,
            ].includes(c.session.baseRevision) &&
            matchesBase(c.session)
          ) {
            // Earlier clients settled locally before a receipt could be retained.
            // Replay the journal's exact command; never synthesize a new pending edit.
            c.recoveryCommand = retained.command;
            c.retryOnly = true;
            c.message =
              "Retry the retained request to verify the previous save. Editing is paused.";
          } else {
            block(
              c,
              "The local design and retained saves need reconciliation. Your work has been kept.",
            );
            return;
          }
        }
        if (!matchesBase(c.session)) {
          if (
            found.state === "valid" &&
            c.session.status === "idle" &&
            !c.session.dirty &&
            c.session.acknowledged &&
            !c.session.pending &&
            c.session.edit.deletions.length === 0 &&
            !c.session.edit.duplications?.length &&
            input.view.revision >= c.session.baseRevision
          ) {
            // A fully acknowledged cache has no local work to reconcile. Replace
            // it through the same CAS boundary so concurrent edits still win.
            c.session = {
              ...createStudioSaveSession(c.scope, input.view, input.updatedAt),
              generation: c.session.generation,
            };
            if (!(await persist(c))) return;
          } else if (
            c.session.pending &&
            input.view.revision >= c.session.baseRevision
          )
            c.retryOnly = true;
          else {
            c.savedMismatch =
              found.state === "valid" &&
              c.session.status === "idle" &&
              !c.session.pending &&
              input.view.revision >= c.session.baseRevision;
            block(
              c,
              "A newer saved design is available. Your unsaved choices are kept.",
            );
            return;
          }
        }
        // Session status alone is not proof of a rejected command. If its
        // journal refusal could not be stored, retain exact-request retry below.
        if (c.session.pending) {
          const verified = verifyLoadedBaseline(c.session);
          if (!verified) return;
          c.session = settleStudioSave(
            verified,
            c.session.pending.command.requestId,
            { kind: "uncertain" },
          );
          // A newer loaded revision cannot verify this old base. Its exact
          // durable token/request stay untouched until the retained retry proves it.
          if (!c.retryOnly && !(await persist(c))) return;
          c.message = c.retryOnly
            ? "The saved design has advanced. Retry the exact previous request to check its result; editing is paused."
            : "A previous save is unconfirmed. Retry the retained request to check its result.";
        }
      } else {
        block(
          c,
          found.message,
          found.state === "unavailable" ? "unavailable" : "recovery",
        );
        return;
      }
      const verified = verifyLoadedBaseline(c.session);
      if (!verified) return;
      const beforeEnrichment = JSON.stringify(c.session);
      c.session = verified;
      if (
        c.session &&
        (!c.session.baselinePergolaIds || !c.session.baselineObjectOptions) &&
        matchesBase(c.session)
      ) {
        c.session.baselinePergolaIds = input.view.spatial.pergolas.map(
          (p) => p.id,
        );
        c.session.baselineObjectOptions = structuredClone(
          input.view.objectOptions,
        );
      }
      if (JSON.stringify(c.session) !== beforeEnrichment && !(await persist(c))) return;
      c.status = "ready";
      publish(c);
    }
    void c.lifecycle.ready.then(() => {
      if (!navigator.locks?.request)
        block(
          c,
          "This browser could not protect design editing across tabs. Reload in a browser with Web Locks support.",
          "unavailable",
        );
      else requestRestore();
    });
    return () => {
      c.live = false;
      c.lifecycle?.detach();
    };
    // All inputs are captured in the value identity; helpers operate on that isolated context.
  }, [identity]);

  const authoredIdentity = (c: Context): StudioAuthoredIdentity => ({
    scopeKey: JSON.stringify(c.scope),
    epoch: c.epoch,
    generation: c.session!.generation,
  });
  const refusal = (reason: string): StudioChangeOutcome => ({
    kind: "refused",
    reason,
  });
  function mutationContext() {
    const c = context.current;
    return c &&
      active(c) &&
      c.lifecycle?.allowed() &&
      c.identity === identity &&
      !c.blocked &&
      !c.quoteInFlight &&
      !c.retryOnly &&
      c.session &&
      ["ready", "saving"].includes(c.status)
      ? c
      : null;
  }
  function accept(c: Context, edit: StudioAuthoringEdit, history?: StudioHistoryChange, recordHistory = true): StudioChangeOutcome {
    const previous = c.session!.edit;
    try {
      c.session = changeStudioSaveSession(c.session!, edit, { selection: history?.selectionBefore, coalesce: !!history?.group && history.group === c.historyGroup, record: recordHistory });
      if(recordHistory)c.historyGroup = history?.group;
      c.message = null;
      const result: StudioChangeOutcome = {
        kind: "accepted",
        previous,
        edit: c.session.edit,
        identity: authoredIdentity(c),
      };
      void persist(c);
      return result;
    } catch {
      return refusal(
        "This edit could not be validated. Your previous local work has been kept.",
      );
    }
  }
  const change = (edit: StudioAuthoringEdit, history?: StudioHistoryChange): StudioChangeOutcome => {
    const c = mutationContext();
    return c
      ? accept(c, edit, history)
      : refusal("This design cannot currently be edited. Your work is kept.");
  };
  /** Fresh derived values share the guarded, durable edit owner without becoming
   * a new user action that would prevent Undo reaching its preceding geometry. */
  const changeDerived = (edit: StudioAuthoringEdit): StudioChangeOutcome => {
    const c=mutationContext();
    return c ? accept(c,edit,undefined,false)
      : refusal("This design cannot currently be edited. Your work is kept.");
  };
  const transact = (
    expected: StudioAuthoredIdentity,
    create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
    history?: StudioHistoryChange,
  ): StudioChangeOutcome => {
    const c = mutationContext();
    if (!c)
      return refusal(
        "This design cannot currently be edited. Your work is kept.",
      );
    if (!sameStudioAuthoredIdentity(expected, authoredIdentity(c)))
      return refusal("Design changed. Start the move again.");
    // Save acknowledgement may have advanced revision/deletion/duplication
    // bookkeeping without changing generation. Never construct from a snapshot.
    try {
      return accept(c, create(c.session!.edit), history);
    } catch (error) {
      return refusal(
        error instanceof Error
          ? error.message
          : "Placement could not be applied.",
      );
    }
  };
  const restoreEdit = (previous: StudioAuthoringEdit): StudioChangeOutcome => {
    const c = mutationContext();
    if (!c)
      return refusal(
        "This design cannot currently be edited. Your Undo is kept.",
      );
    if (previous.designId !== c.scope.designId)
      return refusal("This Undo belongs to another design.");
    return accept(c, rebaseStudioUndoEdit(previous, c.session!));
  };
  const captureEdit = (expected: StudioAuthoredIdentity): StudioAuthoringEdit | null => {
    const c = mutationContext();
    return c && sameStudioAuthoredIdentity(expected, authoredIdentity(c))
      ? structuredClone(c.session!.edit) : null;
  };
  const navigateHistory = (direction: "undo" | "redo", selection?: string): StudioChangeOutcome & { selection?: string } => {
    const c = mutationContext();
    if (!c) return refusal("Finish the current operation before using Undo or Redo. Your history is kept.");
    if (direction === "redo" && (c.status !== "ready" || c.session?.pending)) return refusal("Finish saving before using Redo. Your history is kept.");
    try {
      const previous = c.session!.edit, result = navigateStudioSaveHistory(c.session!, direction, selection);
      c.session = result.session; c.historyGroup = undefined; c.message = null;
      void persist(c);
      return { kind: "accepted", previous, edit: c.session.edit, identity: authoredIdentity(c), selection: result.selection };
    } catch (error) { return refusal(error instanceof Error ? error.message : "History could not be restored. Your work is kept."); }
  };
  const runSave = async (retry: boolean) => {
    if(context.current?.quoteRecoveryCommand||context.current?.session?.pending?.operation==='quote_create.v1')return;
    const c = context.current;
    if (
      !c ||
      !active(c) ||
      !c.lifecycle?.allowed() ||
      c.identity !== identity ||
      c.blocked ||
      c.saving ||
      !c.session ||
      c.status !== "ready"
    )
      return;
    if (
      retry !== Boolean(c.session.pending || c.recoveryCommand) ||
      (!retry && (!c.session.dirty || c.retryOnly))
    )
      return;
    c.saving = true;
    c.status = "saving";
    c.message = null;
    try {
      if (!c.recoveryCommand)
        c.session = prepareStudioSave(c.session, crypto.randomUUID());
      const command = c.recoveryCommand ?? c.session.pending!.command;
      // Only a loaded, advanced saved view can check the retained retry's new
      // baseline. Ordinary save props still describe the pre-request design.
      const checkLoadedReceipt = Boolean(c.recoveryCommand) ||
        (c.retryOnly && (c.session.baseRevision !== props.view.revision ||
          c.session.baseUpdatedAt !== props.updatedAt));
      if ((!c.retryOnly && !(await persist(c))) || !active(c) || !c.lifecycle?.allowed()) return;
      const result = await sendStudioCommand(c.scope, command,()=>active(c)&&Boolean(c.lifecycle?.allowed()));
      if (!active(c) || !c.lifecycle?.allowed() || c.blocked || !c.session)
        return;
      if (result.state === "confirmed") {
        if (
          (c.retryOnly &&
            (result.receipt.revision !== c.serverRevision ||
              result.receipt.savedAt !== c.serverUpdatedAt)) ||
          (c.recoveryCommand &&
            (result.receipt.revision !== c.session.baseRevision ||
              result.receipt.savedAt !== c.session.baseUpdatedAt))
        ) {
          block(
            c,
            "The original save was confirmed, but another saved revision differs. Your local work is retained for reconciliation.",
          );
          return;
        }
        if (!result.receiptStored) {
          c.session = settleStudioSave(c.session, command.requestId, {
            kind: "uncertain",
          });
          if ((!c.retryOnly && !(await persist(c))) || !active(c)) return;
          c.retryOnly = true;
          c.serverRevision = result.receipt.revision;
          c.serverUpdatedAt = result.receipt.savedAt;
          c.status = "ready";
          c.message =
            "Saved on the server, but the confirmation could not be retained. Retry the exact request; editing is paused.";
          publish(c);
          return;
        }
        let settled = c.recoveryCommand
          ? reconcileStudioConfirmedCommand(c.session, command, result.receipt)
          : settleStudioSave(c.session, command.requestId, {
              kind: "success",
              receipt: result.receipt,
            });
        if (checkLoadedReceipt && settled.baseRevision === props.view.revision &&
            settled.baseUpdatedAt === props.updatedAt) {
          try {
            settled = reconcileStudioSaveBaseline(settled, props.view, props.updatedAt);
          } catch (error) {
            block(c, error instanceof Error ? error.message : "The confirmed save baseline could not be verified.");
            return;
          }
        }
        c.session = settled;
        if (!(await persist(c)) || !active(c)) return;
        if (
          c.session.pending ||
          c.session.baseRevision !== result.receipt.revision
        ) {
          block(
            c,
            "The confirmed save is retained. Reconcile the duplicate source before continuing.",
          );
          return;
        }
        if (
          !(await acknowledgeStudioCommand(c.scope, command, {
            body: result.body,
            receipt: result.receipt,
          }))
        ) {
          block(
            c,
            "Saved on the server. The local confirmation still needs recovery; your work is retained.",
          );
          return;
        }
        if (!active(c) || !c.lifecycle?.allowed()) return;
        c.retryOnly = false;
        c.recoveryCommand = null;
        c.message = c.session.dirty
          ? "Saved. Newer changes remain to be saved."
          : "Saved.";
      } else {
        const rejected = result.state === "rejected";
        c.session = settleStudioSave(c.session, command.requestId, {
          kind: rejected
            ? result.status === 409
              ? "conflict"
              : "rejected"
            : "uncertain",
        });
        if ((!c.retryOnly && !(await persist(c))) || !active(c)) return;
        c.message = result.message;
        if (rejected || result.state === "blocked") {
          const current = await readStudioWorkingCopy(c.scope);
          if (!active(c) || !c.lifecycle?.allowed()) return;
          c.savedMismatch = canUseSavedStudioWorkingCopy(current, c.session);
          if (c.savedMismatch || result.state === "blocked" || current.state !== "valid") {
            block(c, result.message);
            return;
          }
          // A refusal whose local journal write failed remains an exact retry,
          // never permission to retire the command or start another Save.
        }
      }
      c.status = "ready";
      publish(c);
    } catch {
      if (active(c))
        block(
          c,
          "The save could not be completed safely. Your working copy and request are retained.",
        );
    } finally {
      c.saving = false;
      if (
        active(c) &&
        !c.lifecycle?.allowed() &&
        c.session?.pending &&
        !c.blocked
      ) {
        c.status = "ready";
        c.message = "The request is retained for explicit recovery.";
        publish(c);
      }
    }
  };
  const useSaved = async () => {
    const c = context.current;
    if (
      !c ||
      !active(c) ||
      !c.lifecycle?.allowed() ||
      !props.editable ||
      !c.savedMismatch ||
      c.saving ||
      !c.session ||
      !c.token
    )
      return;
    c.saving = true;
    publish(c);
    try {
      const result = await useSavedStudioDesign(c.scope, c.token, structuredClone(c.session), () => active(c) && Boolean(c.lifecycle?.allowed()));
      if (!active(c) || !c.lifecycle?.allowed()) return;
      c.session = result.session;
      c.token = result.token;
      c.serverRevision = result.session.baseRevision;
      c.serverUpdatedAt = result.updatedAt;
      c.retainedCopies = [...result.retainedCopies, ...c.retainedCopies];
      c.savedMismatch = false;
      c.blocked = false;
      c.retryOnly = false;
      c.recoveryCommand = null;
      c.localPersistFault = null;
      c.queue = Promise.resolve(true);
      c.writes = 0;
      c.durable = true;
      c.status = "ready";
      c.message = null;
    } catch (error) {
      if (active(c))
        c.message =
          error instanceof Error
            ? error.message
            : "Your retained work is kept; the saved design could not be loaded.";
    } finally {
      c.saving = false;
      publish(c);
    }
  };
  const restoreChoices = (key: string) => {
    const c = context.current;
    if (
      !c ||
      !active(c) ||
      !c.lifecycle?.allowed() ||
      c.status !== "ready" ||
      c.blocked ||
      !c.session ||
      c.session.dirty ||
      c.session.pending
    )
      return;
    const retained = c.retainedCopies.find((copy) => copy.key === key);
    if (!retained) return;
    try {
      change(restoreRetainedWebsiteChoices(c.session.edit, retained));
    } catch (error) {
      c.message =
        error instanceof Error
          ? error.message
          : "The retained choices could not be restored.";
      publish(c);
    }
  };
  const quoteAuthority=(c:Context,command:StudioPendingCommand)=>Boolean(active(c)&&c.lifecycle?.allowed()&&!c.blocked&&c.quoteInFlight&&JSON.stringify(c.activeQuoteCommand)===JSON.stringify(command));
  const beginQuote=async(requestId:string):Promise<StudioPendingCommand>=>{
    const c=context.current;
    if(!c||!active(c)||!c.lifecycle?.allowed()||c.blocked||c.saving||!c.session||!c.durable||c.status!=='ready'||(c.retryOnly&&!c.quoteRecoveryCommand)||(!props.editable&&!c.quoteRecoveryCommand))throw Error('Finish recovering the current design before creating the quote.');
    if(c.session.pending&&c.session.pending.operation!=='quote_create.v1')throw Error('Recover the previous Save before creating a quote.');
    if(c.session.pending&&c.session.pending.generation!==c.session.generation)throw Error('Your earlier quote request is retained. Recover it before quoting later edits.');
    c.saving=true;c.quoteInFlight=true;c.status='saving';c.message=null;
    try{
      if(!c.quoteRecoveryCommand)c.session=prepareStudioSave({...c.session,dirty:true},requestId,'quote_create.v1');
      const command=c.quoteRecoveryCommand??c.session.pending!.command;
      c.quoteRecoveryCommand=command;c.activeQuoteCommand=command;
      const staged=await stageStudioCommand(c.scope,command,'quote_create.v1');
      if(staged.state!=='valid'||staged.operation!=='quote_create.v1'||staged.rejectedStatus!==null)throw Error('The quote request could not be retained. Your design is kept.');
      if(c.session.pending&&!(await persist(c)))throw Error('The quote request is retained. Reopen this design before retrying.');
      if(!quoteAuthority(c,command))throw Error('The quote request is retained. Reopen this design before retrying.');
      publish(c);return structuredClone(command);
    }catch(error){c.saving=false;c.quoteInFlight=false;if(!c.blocked)c.status='ready';publish(c);throw error;}
  };
  const finishQuote=async(command:StudioPendingCommand,result:{saveReceipt:import('@/lib/designStudio/saveTransport').StudioSaveReceipt;savedView:StudioAuthoringView;sourceUpdatedAt:string})=>{
    const c=context.current;
    if(!c||!c.session||!quoteAuthority(c,command)||result.savedView.designId!==c.scope.designId||result.savedView.revision!==result.saveReceipt.revision
      ||![command.expectedRevision,command.expectedRevision+1].includes(result.saveReceipt.revision))throw Error('The confirmed quote source could not be reconciled. Your request is retained.');
    c.quoteReceipt=structuredClone(result.saveReceipt);
    try{
      if(!(await recordStudioCommandReceipt(c.scope,command,result.saveReceipt))||!quoteAuthority(c,command))throw Error('The quote is saved, but its local receipt could not be confirmed. The original request is kept.');
      const next=createStudioSaveSession(c.scope,result.savedView,result.sourceUpdatedAt);
      next.generation=c.session.generation;
      if(c.session.history)next.history={...c.session.history,revision:next.baseRevision,generation:next.generation};
      c.session=next;
      if(!(await persist(c))||!c.durable||!quoteAuthority(c,command))throw Error('The quote is saved, but local reconciliation did not finish. Your request, receipt and local work are kept.');
      if(!(await acknowledgeStudioCommand(c.scope,command,{body:JSON.stringify(command),receipt:result.saveReceipt},()=>quoteAuthority(c,command)))||!quoteAuthority(c,command))throw Error('The quote is saved, but its local acknowledgement did not finish. Retry the same quote request.');
      c.status='locked';c.saving=false;c.quoteInFlight=false;c.quoteRecoveryCommand=undefined;c.activeQuoteCommand=undefined;c.retryOnly=false;c.message=null;publish(c);
    }catch(error){
      c.saving=false;c.quoteInFlight=false;c.retryOnly=true;
      if(!c.blocked)c.status='ready';
      c.message=error instanceof Error?error.message:'The saved quote request needs recovery.';publish(c);throw error;
    }
  };
  const failQuote=()=>{
    const c=context.current;if(!c||!active(c)||!c.quoteInFlight)return;
    if(c.session?.pending)c.session=settleStudioSave(c.session,c.session.pending.command.requestId,{kind:'uncertain'});
    c.saving=false;c.quoteInFlight=false;c.retryOnly=true;if(!c.blocked)c.status='ready';
    c.message='The quote request is retained. Retry the same quote request to confirm the result.';
    if(c.session?.pending&&!c.blocked)void persist(c);publish(c);
  };
  const visible =
    snapshot.identity === identity &&
    getLocalFirstStoreOwner() === props.scope.actorId
      ? snapshot
      : {
          epoch: "",
          savedMismatch: false,
          retainedCopies: [],
          identity,
          session: null,
          status: "loading" as const,
          message: null,
          localDurable: false,
          retryOnly: false,
        };
  const lifecycleAllowed = Boolean(context.current?.lifecycle?.allowed());
  const canEdit =
    lifecycleAllowed &&
    props.editable &&
    !visible.retryOnly &&
    ["ready", "saving"].includes(visible.status);
  return {
    ...visible,
    authoredIdentity: {
      scopeKey: JSON.stringify(props.scope),
      epoch: visible.epoch,
      generation: visible.session?.generation ?? 0,
    } as StudioAuthoredIdentity,
    transact,
    restoreEdit,
    captureEdit,
    undo: (selection?: string) => navigateHistory("undo", selection),
    redo: (selection?: string) => navigateHistory("redo", selection),
    endHistoryGroup: () => { if (context.current) context.current.historyGroup = undefined; },
    canUndo: canEdit && !!visible.session?.history?.past.length,
    canRedo: canEdit && visible.status === "ready" && !visible.session?.pending && !!visible.session?.history?.future.length,
    edit: visible.session?.edit ?? null,
    canEdit,
    canSave:
      lifecycleAllowed &&
      !visible.retryOnly &&
      visible.status === "ready" &&
      Boolean(visible.session?.dirty) &&
      !visible.session?.pending,
    canRetry:
      !context.current?.quoteRecoveryCommand &&
      visible.session?.pending?.operation!=='quote_create.v1' &&
      lifecycleAllowed &&
      visible.status === "ready" &&
      (visible.retryOnly || Boolean(visible.session?.pending)),
    canUseSaved: lifecycleAllowed && props.editable && visible.savedMismatch,
    canRestoreChoices:
      canEdit && !visible.session?.dirty && !visible.session?.pending,
    useSaved,
    restoreChoices,
    beginQuote,
    canSubmitQuote:(command:StudioPendingCommand)=>{const c=context.current;return Boolean(c&&quoteAuthority(c,command));},
    canRetryQuote:Boolean(context.current&&lifecycleAllowed&&!context.current.blocked&&!context.current.saving&&context.current.quoteRecoveryCommand),
    quoteRecoveryCommand:context.current?.quoteRecoveryCommand??null,
    finishQuote,
    failQuote,
    change,
    changeDerived,
    save: () => runSave(false),
    retry: () => runSave(true),
  };
}
