import { rebaseStudioDuplications } from "./pergolaDuplicationRebase";
import { isStudioObject, type StudioJsonObject } from "./contracts";
import {
  createStudioAuthoringEdit,
  parseStudioAuthoringEdit,
  studioAuthoringRowOrder,
  type StudioAuthoringEdit,
  type StudioAuthoringView,
} from "./authoringView";
import type {
  StudioPendingCommand,
  StudioSaveScope,
  StudioSaveReceipt,
} from "./saveTransport";
import { boundedStudioHistory, recordStudioHistory, type StudioEditHistory } from "./editHistory";

export type { StudioSaveReceipt } from "./saveTransport";
export type StudioSaveSession = {
  scope: StudioSaveScope;
  baseRevision: number;
  baselinePergolaIds?: string[];
  baselineObjectOptions?: StudioAuthoringEdit["objectOptions"];
  acknowledged?: {
    scope: StudioSaveScope;
    updatedAt: string | null;
    edit: StudioAuthoringEdit;
  };
  baseUpdatedAt: string | null;
  edit: StudioAuthoringEdit;
  generation: number;
  dirty: boolean;
  status: "idle" | "pending" | "uncertain" | "conflict" | "rejected";
  pending: { command: StudioPendingCommand; generation: number; operation?:'quote_create.v1' } | null;
  history?: StudioEditHistory;
};

// Only object insertion order and root transport bookkeeping are immaterial.
// Arrays, raw strings, missing fields and live patch operations remain authored.
function sameAuthoringValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => sameAuthoringValue(value, b[index]));
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((key) => Object.hasOwn(right, key) && sameAuthoringValue(left[key], right[key]));
}

export function sameStudioAuthoredContent(a: StudioAuthoringEdit, b: StudioAuthoringEdit) {
  return a.designId === b.designId && sameAuthoringValue(
    [a.spatial, a.site, a.objectOptions, a.deletions, a.duplications ?? []],
    [b.spatial, b.site, b.objectOptions, b.deletions, b.duplications ?? []],
  );
}

function isDirty(state: StudioSaveSession, edit = state.edit) {
  return Boolean(state.pending) || state.status !== "idle" ||
    !state.acknowledged || !sameStudioAuthoredContent(edit, state.acknowledged.edit);
}

/** A retained journal without a confirmed receipt still owns write authority,
 * even when an older client already removed its local pending field. */
export function reconcileStudioSaveDirty(state: StudioSaveSession, unsettledJournal = false) {
  return { ...structuredClone(state), dirty: unsettledJournal || isDirty(state) };
}

/** Safe DTO only; private server envelopes never belong in a working copy. */
export function createStudioSaveSession(
  scope: StudioSaveScope,
  view: StudioAuthoringView,
  updatedAt: string | null,
): StudioSaveSession {
  const parsed = parseStudioAuthoringEdit(createStudioAuthoringEdit(view));
  if (
    !parsed.ok ||
    scope.designId !== view.designId ||
    (updatedAt !== null && !Number.isFinite(Date.parse(updatedAt)))
  )
    throw new Error("Invalid saved design");
  return {
    scope: structuredClone(scope),
    baseRevision: view.revision,
    baseUpdatedAt: updatedAt,
    baselinePergolaIds: view.spatial.pergolas.map((p) => p.id),
    baselineObjectOptions: structuredClone(view.objectOptions),
    acknowledged: { scope: structuredClone(scope), updatedAt, edit: structuredClone(parsed.value) },
    edit: parsed.value,
    generation: 0,
    dirty: false,
    status: "idle",
    pending: null,
  };
}

/** Only the verified loaded base can enrich a legacy copy. Never use its live
 * edit as an acknowledged baseline or silently repair conflicting metadata. */
export function reconcileStudioSaveBaseline(state: StudioSaveSession, view: StudioAuthoringView, updatedAt: string | null, unsettledJournal = false) {
  if (state.scope.designId !== view.designId || state.baseRevision !== view.revision || state.baseUpdatedAt !== updatedAt)
    throw Error("The saved authoring baseline changed. Your local work is kept.");
  const trusted = createStudioSaveSession(state.scope, view, updatedAt).acknowledged!;
  if (state.acknowledged && (
    !sameAuthoringValue(state.acknowledged.scope, state.scope) || state.acknowledged.updatedAt !== updatedAt ||
    state.acknowledged.edit.revision !== view.revision || state.acknowledged.edit.deletions.length || state.acknowledged.edit.duplications?.length ||
    !sameStudioAuthoredContent(state.acknowledged.edit, trusted.edit)))
    throw Error("The saved authoring baseline differs. Your local work is kept.");
  const next = { ...structuredClone(state), acknowledged: trusted };
  return reconcileStudioSaveDirty(next, unsettledJournal);
}

/** A retained, already-settled request still needs its exact SENT authority.
 * Never certify the live edit or retire a contradictory receipt as legacy. */
export function reconcileStudioConfirmedCommand(
  state: StudioSaveSession,
  command: StudioPendingCommand,
  receipt: StudioSaveReceipt,
) {
  const parsed = parseStudioAuthoringEdit(command.edit);
  if (state.pending || state.status !== "idle" || !parsed.ok || parsed.value.designId !== state.scope.designId ||
      parsed.value.revision !== command.expectedRevision ||
      ![command.expectedRevision, command.expectedRevision + 1].includes(receipt.revision))
    throw Error("The confirmed save baseline could not be verified. Your local work is kept.");
  const sent = retireAcknowledgedOperations(parsed.value, parsed.value, receipt.revision);
  return reconcileStudioSaveBaseline(state, {
    ...sent,
    schemaVersion: "studio_authoring_view.v1",
    pricing: "unpriced",
  }, receipt.savedAt);
}

/** Edits may continue during a request; its frozen command remains unchanged. */
export function changeStudioSaveSession(
  state: StudioSaveSession,
  edit: StudioAuthoringEdit,
  history?: { selection?: string; coalesce?: boolean; record?: boolean },
): StudioSaveSession {
  if (state.pending) {
    const existing = new Map(
      (state.edit.duplications ?? []).map((op) => [
        op.targetId,
        JSON.stringify(op),
      ]),
    );
    if (
      (edit.duplications ?? []).some(
        (op) => existing.get(op.targetId) !== JSON.stringify(op),
      )
    )
      throw Error("Finish saving before making another copy.");
  }
  const parsed = parseStudioAuthoringEdit(edit);
  if (
    !parsed.ok ||
    edit.designId !== state.scope.designId ||
    edit.revision !== state.baseRevision
  )
    throw new Error("Invalid working design");
  if (!Number.isSafeInteger(state.generation + 1))
    throw new Error("Reload before continuing this editing session");
  const next = structuredClone(state);
  if (history?.record !== false && !sameStudioAuthoredContent(state.edit, parsed.value)) {
    const recorded = recordStudioHistory(next.history, state.edit, state.generation + 1, state.baseRevision, history?.selection, Boolean(history?.coalesce));
    if (recorded.past.length || recorded.future.length) next.history = recorded;
    else delete next.history;
  }
  else if (next.history) next.history.generation = state.generation + 1;
  return {
    ...next,
    edit: parsed.value,
    generation: state.generation + 1,
    dirty: isDirty(state, parsed.value),
  };
}

/** Restore semantic choices without replaying operations already acknowledged
 * by a later save. Transport bookkeeping belongs to the current session. */
export function rebaseStudioUndoEdit(
  previous: StudioAuthoringEdit,
  current: StudioSaveSession,
): StudioAuthoringEdit {
  const edit = structuredClone(previous);
  edit.revision = current.baseRevision;
  edit.deletions = edit.deletions.flatMap<
    StudioAuthoringEdit["deletions"][number]
  >((deletion) => {
    const live = current.edit.deletions;
    if (deletion.scope === "object-options")
      return live.some(
        (d) => d.scope === deletion.scope && d.objectId === deletion.objectId,
      )
        ? [deletion]
        : [];
    if (deletion.scope === "object-option")
      return live.some(
        (d) =>
          d.scope === deletion.scope &&
          d.objectId === deletion.objectId &&
          d.field === deletion.field,
      )
        ? [deletion]
        : [];
    const ids = deletion.ids.filter((id) =>
      live.some(
        (d) =>
          d.scope === deletion.scope &&
          "collection" in d &&
          d.collection === deletion.collection &&
          (d.scope !== "object" ||
            (deletion.scope === "object" &&
              d.objectId === deletion.objectId)) &&
          "ids" in d &&
          d.ids.includes(id),
      ),
    );
    return ids.length ? [{ ...deletion, ids }] : [];
  });
  rebaseUndoRemovals(edit, current);
  if (edit.duplications) {
    const live = new Map(
      (current.edit.duplications ?? []).map((op) => [op.targetId, op]),
    );
    edit.duplications = edit.duplications.flatMap((op) => {
      if (current.baselinePergolaIds?.includes(op.targetId) || current.pending?.command.edit.spatial.pergolas.some(p => p.id === op.targetId)) return [];
      if (live.has(op.targetId)) return [structuredClone(live.get(op.targetId)!)];
      const restored = structuredClone(op);
      if (!restored.sourceId || !current.baselinePergolaIds?.includes(restored.sourceId)) restored.sourceId = null;
      for (const [section, collection] of [["flashings", "rows"], ["infills", "items"]] as const) {
        const container = current.baselineObjectOptions?.find(row => row.objectId === restored.sourceId)?.values[section];
        const rows = isStudioObject(container) && Array.isArray(container[collection]) ? container[collection] : [];
        for (const id of Object.keys(restored.rowOrigins[section]))
          if (!rows.some(row => isStudioObject(row) && row.id === restored.rowOrigins[section][id])) restored.rowOrigins[section][id] = null;
      }
      return [restored];
    });
  }
  rebaseUndoRowOrder(edit, current);
  return edit;
}

/** History is a full visible snapshot, while supported row collections are
 * server patches. Express their existing saved order before freezing SENT. */
function rebaseUndoRowOrder(edit: StudioAuthoringEdit, current: StudioSaveSession) {
  const baseline = current.acknowledged?.edit, pending = current.pending?.command.edit;
  let objectIds = (current.baselineObjectOptions ?? baseline?.objectOptions ?? []).map(row => row.objectId);
  if (pending) objectIds = studioAuthoringRowOrder(objectIds, [
    ...(pending.duplications ?? []).map(op => op.targetId), ...pending.objectOptions.map(row => row.objectId),
  ]).filter(id => !pending.deletions.some(d => d.scope === "object-options" && d.objectId === id));
  const options = new Map(edit.objectOptions.map(row => [row.objectId, row]));
  edit.objectOptions = studioAuthoringRowOrder(objectIds, [
    ...(edit.duplications ?? []).map(op => op.targetId), ...edit.objectOptions.map(row => row.objectId),
  ]).flatMap(id => options.has(id) ? [options.get(id)!] : []);
  const rowIds = (owner: StudioJsonObject | undefined, section: string, key: string) => {
    const container = owner?.[section];
    return isStudioObject(container) && Array.isArray(container[key])
      ? container[key].flatMap(row => isStudioObject(row) && typeof row.id === "string" ? [row.id] : []) : [];
  };
  function rows(owner: StudioJsonObject, before: StudioJsonObject | undefined, sent: StudioJsonObject | undefined, collection: string, objectId?: string) {
    const [section, key] = collection.split("."), container = owner[section];
    if (!isStudioObject(container) || !Array.isArray(container[key])) return;
    let ids = rowIds(before, section, key);
    if (pending) ids = studioAuthoringRowOrder(ids, rowIds(sent, section, key)).filter(id => !pending.deletions.some(d =>
      (objectId ? d.scope === "object" && d.objectId === objectId : d.scope === "site") &&
      "collection" in d && d.collection === collection && d.ids.includes(id)));
    const targets = new Map(container[key].map(row => [isStudioObject(row) ? row.id : undefined, row]));
    container[key] = studioAuthoringRowOrder(ids, rowIds(owner, section, key)).flatMap(id => targets.has(id) ? [targets.get(id)!] : []);
  }
  for (const collection of ["blinds.items", "additionalAluminium.rows", "standaloneInfills.items"])
    rows(edit.site, baseline?.site, pending?.site, collection);
  for (const row of edit.objectOptions) for (const collection of ["flashings.rows", "infills.items"])
    rows(row.values, (current.baselineObjectOptions ?? baseline?.objectOptions)?.find(r => r.objectId === row.objectId)?.values,
      pending?.objectOptions.find(r => r.objectId === row.objectId)?.values, collection, row.objectId);
}

export function navigateStudioSaveHistory(state: StudioSaveSession, direction: "undo" | "redo", selection?: string) {
  const history = structuredClone(state.history), from = direction === "undo" ? "past" : "future", to = direction === "undo" ? "future" : "past";
  const target = history?.[from].pop();
  if (!history || !target) throw Error(`Nothing to ${direction}.`);
  const next = changeStudioSaveSession(state, rebaseStudioUndoEdit(target.edit, state), { record: false });
  history[to].push({ edit: structuredClone(state.edit), ...(selection !== undefined ? { selection } : {}) });
  next.history = boundedStudioHistory({ ...history, generation: next.generation, revision: next.baseRevision });
  return { session: next, selection: target.selection };
}

/** Omission is a patch, not deletion. Undo must remove values that reached (or
 * are frozen on their way to) the server, without tombstoning unsaved-only IDs. */
function rebaseUndoRemovals(edit: StudioAuthoringEdit, current: StudioSaveSession) {
  const bases = [current.acknowledged?.edit, current.pending?.command.edit]
    .filter((value): value is StudioAuthoringEdit => !!value);
  const liveObjects = new Set(edit.spatial.pergolas.map(p => p.id));
  const knownObjects = new Set([
    ...(current.baselinePergolaIds ?? []),
    ...bases.flatMap(base => base.spatial.pergolas.map(p => p.id)),
  ]);
  for (const objectId of knownObjects)
    if (!liveObjects.has(objectId) && !edit.deletions.some(d => d.scope === "object-options" && d.objectId === objectId))
      edit.deletions.push({ scope: "object-options", objectId });
  function rows(before: StudioJsonObject, after: StudioJsonObject, collection: string,
    deletion: { scope: "site" } | { scope: "object"; objectId: string }) {
    const [section, key] = collection.split("."), source = before[section];
    if (!isStudioObject(source) || !Array.isArray(source[key])) return;
    const target = after[section], values = isStudioObject(target) && Array.isArray(target[key]) ? target[key] : [];
    const ids = source[key].flatMap(row => isStudioObject(row) && typeof row.id === "string" &&
      !values.some(value => isStudioObject(value) && value.id === row.id) ? [row.id] : []);
    if (!ids.length) return;
    // Use the existing removal shape. The server preserves omitted section
    // metadata, so retain it exactly instead of claiming absence unsets it.
    after[section] = { ...structuredClone(source), ...(isStudioObject(target) ? target : {}), [key]: values };
    const existing = edit.deletions.find(d => d.scope === deletion.scope && "collection" in d &&
      d.collection === collection && (deletion.scope === "site" || ("objectId" in d && d.objectId === deletion.objectId)));
    if (existing && "ids" in existing) existing.ids = [...new Set([...existing.ids, ...ids])];
    else edit.deletions.push({ ...deletion, collection, ids } as StudioAuthoringEdit["deletions"][number]);
  }
  for (const base of bases) {
    for (const collection of ["blinds.items", "additionalAluminium.rows", "standaloneInfills.items"])
      rows(base.site, edit.site, collection, { scope: "site" });
    for (const before of base.objectOptions) {
      if (!liveObjects.has(before.objectId)) continue;
      // The server retains the public row after supported resets. Carry its
      // empty shape so the SENT baseline matches the next saved projection.
      const target = edit.objectOptions.find(row => row.objectId === before.objectId);
      const after = target?.values ?? {};
      if (!target) edit.objectOptions.push({ objectId: before.objectId, values: after });
      for (const collection of ["flashings.rows", "infills.items"])
        rows(before.values, after, collection, { scope: "object", objectId: before.objectId });
      if (Object.hasOwn(before.values, "ceilingOption") && !Object.hasOwn(after, "ceilingOption") &&
          !edit.deletions.some(d => d.scope === "object-option" && d.objectId === before.objectId && d.field === "ceilingOption"))
        edit.deletions.push({ scope: "object-option", objectId: before.objectId, field: "ceilingOption" });
    }
  }
}

/** Transport must durably retain this command before sending it. Calling again
 * during uncertainty returns the original command, even after further edits. */
export function prepareStudioSave(
  state: StudioSaveSession,
  requestId: string,
  operation?:'quote_create.v1',
): StudioSaveSession {
  if(state.pending&&(state.pending.operation??'save')!==(operation??'save'))throw Error('The retained operation must be recovered through its original action.');
  if (state.status === "conflict" || state.status === "rejected")
    throw new Error("Resolve the previous save before continuing");
  if (state.pending) return structuredClone(state);
  if (!state.dirty) return structuredClone(state);
  if (state.status !== "idle")
    throw new Error("Resolve the previous save before continuing");
  return {
    ...structuredClone(state),
    status: "pending",
    pending: {
      ...(operation?{operation}:{}),
      generation: state.generation,
      command: {
        requestId,
        expectedUpdatedAt: state.baseUpdatedAt,
        expectedRevision: state.baseRevision,
        edit: structuredClone(state.edit),
      },
    },
  };
}

function remainingDeletions(
  current: StudioAuthoringEdit["deletions"],
  sent: StudioAuthoringEdit["deletions"],
) {
  return current.flatMap<StudioAuthoringEdit["deletions"][number]>(
    (deletion) => {
      if (deletion.scope === "object-options")
        return sent.some(
          (item) =>
            item.scope === deletion.scope &&
            item.objectId === deletion.objectId,
        )
          ? []
          : [deletion];
      if (deletion.scope === "object-option")
        return sent.some(
          (item) =>
            item.scope === deletion.scope &&
            item.objectId === deletion.objectId &&
            item.field === deletion.field,
        )
          ? []
          : [deletion];
      const acknowledged = sent.filter(
        (item) =>
          item.scope === deletion.scope &&
          "collection" in item &&
          item.collection === deletion.collection &&
          (item.scope !== "object" ||
            (deletion.scope === "object" &&
              item.objectId === deletion.objectId)),
      );
      const ids = deletion.ids.filter(
        (id) =>
          !acknowledged.some((item) => "ids" in item && item.ids.includes(id)),
      );
      return ids.length ? [{ ...deletion, ids }] : [];
    },
  );
}

export function settleStudioSave(
  state: StudioSaveSession,
  requestId: string,
  result:
    | { kind: "success"; receipt: StudioSaveReceipt }
    | { kind: "uncertain" | "conflict" | "rejected" },
): StudioSaveSession {
  if (!state.pending || state.pending.command.requestId !== requestId)
    return structuredClone(state);
  if (result.kind !== "success")
    return { ...structuredClone(state), status: result.kind };
  const { receipt } = result;
  if (
    !Number.isSafeInteger(receipt.revision) ||
    ![state.baseRevision, state.baseRevision + 1].includes(receipt.revision) ||
    !Number.isFinite(Date.parse(receipt.savedAt)) ||
    typeof receipt.alreadyExisted !== "boolean"
  ) {
    return { ...structuredClone(state), status: "uncertain" };
  }
  let edit: StudioAuthoringEdit, acknowledgedEdit: StudioAuthoringEdit;
  try {
    edit = retireAcknowledgedOperations(state.edit, state.pending.command.edit, receipt.revision);
    acknowledgedEdit = retireAcknowledgedOperations(state.pending.command.edit, state.pending.command.edit, receipt.revision);
  } catch {
    return { ...structuredClone(state), status: "uncertain" };
  }
  return {
    ...structuredClone(state),
    edit,
    baselinePergolaIds: state.pending.command.edit.spatial.pergolas.map(
      (p) => p.id,
    ),
    baselineObjectOptions: structuredClone(
      state.pending.command.edit.objectOptions,
    ),
    baseRevision: receipt.revision,
    baseUpdatedAt: receipt.savedAt,
    ...(state.history ? { history: { ...structuredClone(state.history), revision: receipt.revision } } : {}),
    acknowledged: { scope: structuredClone(state.scope), updatedAt: receipt.savedAt, edit: acknowledgedEdit },
    dirty: !sameStudioAuthoredContent(edit, acknowledgedEdit),
    pending: null,
    status: "idle",
  };
}

function retireAcknowledgedOperations(current: StudioAuthoringEdit, sent: StudioAuthoringEdit, revision: number) {
  const edit = structuredClone(current);
  if (edit.duplications) edit.duplications = rebaseStudioDuplications(edit, sent);
  edit.revision = revision;
  edit.deletions = remainingDeletions(edit.deletions, sent.deletions);
  return edit;
}

/** Only a definitive validation rejection can discard its request identity.
 * Conflict resolution requires a fresh saved base; uncertain sends must retry. */
export function discardRejectedStudioRequest(
  state: StudioSaveSession,
): StudioSaveSession {
  if (state.status !== "rejected")
    throw new Error("This request must be reconciled with the server");
  const next = { ...structuredClone(state), pending: null, status: "idle" as const };
  return { ...next, dirty: isDirty(next) };
}
