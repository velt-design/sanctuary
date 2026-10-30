import { expect, it } from "vitest";
import {
  createStudioSaveSession,
  changeStudioSaveSession,
  navigateStudioSaveHistory,
  prepareStudioSave,
  settleStudioSave,
  reconcileStudioSaveBaseline,
} from "./saveSession";
import {
  copyStudioSceneObject,
  pasteStudioSceneObject,
  removeStudioSceneObject,
  nudgeStudioSceneObject,
} from "./studioSceneCommands";
import {
  mergeStudioAuthoringEdit,
  projectStudioAuthoringView,
  type StudioAuthoringEdit,
} from "./authoringView";
import { readStudioHistory } from "./editHistory";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { previewStudioAttachment } from "./studioHouseCommands";
import { websiteComposition } from "./websiteComposition";
import type { StudioAuthoredV1 } from "./contracts";

const scope = {
  actorId: "actor",
  projectId: "project",
  estimateId: "estimate",
  designId: "attachment-physical-proof",
};
const view = () => ({
  ...studioAttachmentFixture(37),
  schemaVersion: "studio_authoring_view.v1" as const,
  pricing: "unpriced" as const,
});
const initial = () => createStudioSaveSession(scope, view(), null);
function stored(edit: StudioAuthoringEdit): StudioAuthoredV1 {
  return {
    schemaVersion: "studio_authored.v1",
    designId: edit.designId,
    revision: edit.revision,
    spatialOutputKey: "drawing_object_first",
    site: { validation: "preserved_unvalidated", values: edit.site },
    objectOptions: edit.objectOptions.map((row) => ({
      objectId: row.objectId,
      options: { validation: "preserved_unvalidated", values: row.values },
    })),
    legacyCommercialAssociations: [],
    provenance: {
      sourceEstimateId: null,
      sourceKind: "authored",
      sourcePayload: null,
    },
  };
}
it("keeps multiple operations, selection, coalescing and branch history separate from the frozen request", () => {
  const base = initial();
  let state = base;
  for (const access of ["easy", "hard", "normal"])
    state = changeStudioSaveSession(
      state,
      { ...state.edit, site: { ...state.edit.site, access } },
      { selection: "p2" },
    );
  expect(state.history?.past).toHaveLength(3);
  state = navigateStudioSaveHistory(state, "undo", "house").session;
  expect(state.edit.site.access).toBe("hard");
  const undone = navigateStudioSaveHistory(state, "undo", "p2");
  expect(undone.selection).toBe("p2");
  state = navigateStudioSaveHistory(undone.session, "redo", "p2").session;
  expect(state.edit.site.access).toBe("hard");
  const pending = prepareStudioSave(state, "request");
  expect(JSON.stringify(pending.pending!.command)).not.toContain('"history"');
  const request = structuredClone(pending.pending);
  const changed = changeStudioSaveSession(pending, {
    ...pending.edit,
    site: { ...pending.edit.site, access: "easy" },
  });
  expect(changed.pending).toEqual(request);
  expect(changed.history?.future).toHaveLength(0);
  const grouped = changeStudioSaveSession(
    changed,
    { ...changed.edit, site: { ...changed.edit.site, access: "normal" } },
    { coalesce: true },
  );
  expect(grouped.history?.past).toHaveLength(changed.history!.past.length);
});
it("retains strict saved dirty truth through Undo/Redo and the actual second-save merge", () => {
  const base = initial(),
    copy = copyStudioSceneObject(base.edit, "p2");
  const pasted = pasteStudioSceneObject(base.edit, copy, "copy", {
    persistedObjectIds: base.baselinePergolaIds!,
    baselineObjectOptions: base.baselineObjectOptions,
  });
  const changed = changeStudioSaveSession(base, pasted, { selection: "p2" }),
    pending = prepareStudioSave(changed, "first");
  const saved = settleStudioSave(pending, "first", {
    kind: "success",
    receipt: {
      revision: 2,
      savedAt: "2026-10-23T06:00:00Z",
      alreadyExisted: false,
    },
  });
  expect(saved.dirty).toBe(false);
  const undo = navigateStudioSaveHistory(saved, "undo", "copy").session;
  expect(undo.dirty).toBe(true);
  expect(undo.edit.deletions).toContainEqual({
    scope: "object-options",
    objectId: "copy",
  });
  const redo = navigateStudioSaveHistory(undo, "redo", "p2").session;
  expect(redo.edit.spatial.pergolas.at(-1)!.id).toBe("copy");
  expect(redo.dirty).toBe(false);
  const undone = navigateStudioSaveHistory(redo, "undo", "copy").session;
  const firstMerge = mergeStudioAuthoringEdit({
    storedAuthored: stored(base.edit),
    storedSpatial: base.edit.spatial,
    edit: pending.pending!.command.edit,
  });
  expect(firstMerge.ok).toBe(true);
  if (!firstMerge.ok) throw Error(firstMerge.message);
  firstMerge.value.authored.revision = 2;
  const second = mergeStudioAuthoringEdit({
    storedAuthored: firstMerge.value.authored,
    storedSpatial: firstMerge.value.spatial,
    edit: undone.edit,
  });
  expect(second.ok).toBe(true);
  if (!second.ok) throw Error(second.message);
  expect(projectStudioAuthoringView(second.value)).toMatchObject({
    ok: true,
    value: {
      spatial: undone.edit.spatial,
      objectOptions: undone.edit.objectOptions,
    },
  });
});
it("uses captured choices after source change/deletion and revalidates current copy provenance", () => {
  const base = initial(),
    copy = copyStudioSceneObject(base.edit, "p2"),
    captured = structuredClone(copy);
  const changed = structuredClone(base.edit);
  changed.site.access = "hard";
  const roof = (
    changed.objectOptions.find((r) => r.objectId === "p2")!.values
      .websiteDesign as any
  ).selection.roof;
  roof.frameFinish = "white";
  const deleted = removeStudioSceneObject(changed, "p2", {
    persistedObjectIds: ["p2"],
  });
  const pasted = pasteStudioSceneObject(deleted, copy, "copy", {
    persistedObjectIds: [],
    baselineObjectOptions: [],
  });
  expect(pasted.site.access).toBe("hard");
  expect(copy).toEqual(captured);
  expect(
    pasted.duplications!.find((op) => op.targetId === "copy")!.sourceId,
  ).toBeNull();
  expect(
    (
      pasted.objectOptions.find((r) => r.objectId === "copy")!.values
        .websiteDesign as any
    ).selection.roof,
  ).toEqual(
    (
      copy.edit.objectOptions.find((r) => r.objectId === "p2")!.values
        .websiteDesign as any
    ).selection.roof,
  );
  const first = pasteStudioSceneObject(base.edit, copy, "unsaved-copy", {
    persistedObjectIds: base.baselinePergolaIds!,
    baselineObjectOptions: base.baselineObjectOptions,
  });
  const copiedCopy = copyStudioSceneObject(first, "unsaved-copy");
  const saved = settleStudioSave(
    prepareStudioSave(changeStudioSaveSession(base, first), "saved-copy"),
    "saved-copy",
    {
      kind: "success",
      receipt: {
        revision: 2,
        savedAt: "2026-10-23T06:10:00Z",
        alreadyExisted: false,
      },
    },
  );
  const pastedLater = pasteStudioSceneObject(saved.edit, copiedCopy, "later", {
    persistedObjectIds: saved.baselinePergolaIds!,
    baselineObjectOptions: saved.baselineObjectOptions,
  });
  expect(
    pastedLater.duplications!.find((op) => op.targetId === "later")!.sourceId,
  ).toBe("unsaved-copy");
});
it("moves House37 with its attached follower and slides an attachment through the canonical along-edge fit", () => {
  const base = studioAttachmentFixture(37),
    connected = previewStudioAttachment(base, {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
      alongEdgeMm: 500,
    });
  const before = websiteComposition(connected)[0];
  const movedHouse = nudgeStudioSceneObject(connected, "house", 10, -100).edit;
  const follower = websiteComposition(movedHouse)[0];
  expect(follower.position!.x).toBeCloseTo(before.position!.x + 10, 6);
  expect(follower.position!.y).toBeCloseTo(before.position!.y - 100, 6);
  const moved = nudgeStudioSceneObject(connected, "p2", -10, 0).edit;
  const actual = websiteComposition(moved)[0],
    binding = actual.studioAttachment!;
  expect(Math.abs(binding.alongEdgeMm! - 500)).toBe(10);
  expect(actual.object.attachment).toEqual(before.object.attachment);
  expect(actual.value).toEqual(before.value);
  const expected = previewStudioAttachment(connected, {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
    alongEdgeMm: binding.alongEdgeMm,
  });
  expect(moved).toEqual(expected);
  const zero = studioAttachmentFixture(0),
    aligned = previewStudioAttachment(zero, {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
      alongEdgeMm: 500,
    });
  expect(() => nudgeStudioSceneObject(aligned, "p2", 0, 10)).toThrow(
    /across the connection/,
  );
});
it("bounds long history and retires optional stale/private metadata without accepting foreign edits", () => {
  let state = initial();
  for (let n = 0; n < 100; n++)
    state = changeStudioSaveSession(state, {
      ...state.edit,
      site: { ...state.edit.site, travelExGst: String(n) },
    });
  expect(state.history!.past.length).toBeLessThanOrEqual(50);
  expect(
    new TextEncoder().encode(JSON.stringify(state.history)).length,
  ).toBeLessThanOrEqual(1024 * 1024);
  expect(
    readStudioHistory(
      { ...state.history, generation: -1 },
      state.edit.designId,
      state.generation,
      state.baseRevision,
    ),
  ).toBeUndefined();
  const foreign = structuredClone(state.history!);
  foreign.past[0].edit.designId = "foreign";
  expect(
    readStudioHistory(
      foreign,
      state.edit.designId,
      state.generation,
      state.baseRevision,
    ),
  ).toBeUndefined();
  const privateData = structuredClone(state.history!);
  privateData.past[0].edit.site.privateCost = 100;
  expect(
    readStudioHistory(
      privateData,
      state.edit.designId,
      state.generation,
      state.baseRevision,
    ),
  ).toBeUndefined();
});
it("retains the latest in-memory Undo and Redo for a large existing edit without putting history on the wire", () => {
  const source = view();
  source.site.travelExGst = "0".repeat(1_800_000);
  const base = createStudioSaveSession(scope, source, null),
    changed = changeStudioSaveSession(base, {
      ...base.edit,
      site: { ...base.edit.site, access: "hard" },
    });
  expect(changed.history!.past).toHaveLength(1);
  expect(
    new TextEncoder().encode(JSON.stringify(changed.history)).length,
  ).toBeGreaterThan(1024 * 1024);
  const undone = navigateStudioSaveHistory(changed, "undo").session;
  expect(undone.edit).toEqual(base.edit);
  expect(undone.dirty).toBe(false);
  const redone = navigateStudioSaveHistory(undone, "redo").session;
  expect(redone.edit).toEqual(changed.edit);
  expect(
    JSON.stringify(prepareStudioSave(redone, "large").pending!.command),
  ).not.toContain('"history"');
});
it("gives copied rows new identities and preserves the captured public values through the actual current-baseline merge", () => {
  const base = initial(),
    source = structuredClone(base.edit);
  source.objectOptions[0].values.flashings = {
    rows: [
      {
        id: "f1",
        kind: "primary",
        band: "301-400",
        lengthM: "6.250",
        purpose: "HEAD",
      },
    ],
  };
  const copy = copyStudioSceneObject(source, "p2"),
    current = structuredClone(source);
  (current.objectOptions[0].values.flashings as any).rows[0].lengthM = "7.000";
  const context = {
    persistedObjectIds: ["p2"],
    baselineObjectOptions: current.objectOptions,
  };
  const pasted = pasteStudioSceneObject(current, copy, "first", context),
    again = pasteStudioSceneObject(pasted, copy, "second", context);
  const first = (
    again.objectOptions.find((r) => r.objectId === "first")!.values
      .flashings as any
  ).rows[0];
  const second = (
    again.objectOptions.find((r) => r.objectId === "second")!.values
      .flashings as any
  ).rows[0];
  expect(first.id).not.toBe("f1");
  expect(second.id).not.toBe(first.id);
  expect(first.lengthM).toBe("6.250");
  const merged = mergeStudioAuthoringEdit({
    storedAuthored: stored(current),
    storedSpatial: current.spatial,
    edit: again,
  });
  expect(merged.ok).toBe(true);
  if (!merged.ok) throw Error(merged.message);
  const projected = projectStudioAuthoringView(merged.value);
  expect(projected.ok).toBe(true);
  if (!projected.ok) throw Error(projected.message);
  expect(
    (
      projected.value.objectOptions.find((r) => r.objectId === "first")!.values
        .flashings as any
    ).rows[0],
  ).toEqual(first);
  const capturedCopy = copyStudioSceneObject(pasted, "first"),
    withoutRows = structuredClone(current);
  withoutRows.objectOptions[0].values.flashings = { rows: [] };
  const later = pasteStudioSceneObject(withoutRows, capturedCopy, "later", {
    persistedObjectIds: ["p2"],
    baselineObjectOptions: withoutRows.objectOptions,
  });
  expect(
    Object.values(
      later.duplications!.find((op) => op.targetId === "later")!.rowOrigins
        .flashings,
    ),
  ).toEqual([null]);
  expect(
    mergeStudioAuthoringEdit({
      storedAuthored: stored(withoutRows),
      storedSpatial: withoutRows.spatial,
      edit: later,
    }).ok,
  ).toBe(true);
});
it("copies and deletes a house through existing composition commands and refuses deletion of an occupied host", () => {
  const base = initial(),
    copy = copyStudioSceneObject(base.edit, "house");
  const removed = removeStudioSceneObject(base.edit, "house", {
    persistedObjectIds: base.baselinePergolaIds!,
  });
  const pasted = pasteStudioSceneObject(removed, copy, "new-house", {
    persistedObjectIds: base.baselinePergolaIds!,
  });
  expect(pasted.spatial.houseAssembly!.houseForms[0]).toEqual({
    ...copy.edit.spatial.houseAssembly!.houseForms[0],
    id: "new-house",
    label: "House 2",
  });
  const attached = previewStudioAttachment(base.edit, {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
  });
  expect(() =>
    removeStudioSceneObject(attached, "house", {
      persistedObjectIds: base.baselinePergolaIds!,
    }),
  ).toThrow(/Detach/);
});
it("keeps a retained host-only attachment exact when the current pose and support cannot be recovered as a Studio along-edge binding", () => {
  const attached = previewStudioAttachment(studioAttachmentFixture(37), {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
  });
  delete attached.site.websiteAttachments;
  const before = structuredClone(attached),
    physical = websiteComposition(attached);
  expect(() => nudgeStudioSceneObject(attached, "p2", -10, 0)).toThrow(
    /current pose and height/,
  );
  expect(attached).toEqual(before);
  expect(websiteComposition(attached)).toEqual(physical);
});
it.each(["pending", "acknowledged"])(
  "keeps restored object rows in canonical saved order through a %s deletion, Undo, Save and strict reopen",
  (timing) => {
    const base = initial();
    let state = base,
      server = { authored: stored(base.edit), spatial: base.edit.spatial },
      count = 0;
    const save = (during?: () => void) => {
      const request = "roundtrip-" + ++count;
      state = prepareStudioSave(state, request);
      const frozen = structuredClone(state.pending!.command);
      const merged = mergeStudioAuthoringEdit({
        storedAuthored: server.authored,
        storedSpatial: server.spatial,
        edit: frozen.edit,
      });
      expect(merged.ok).toBe(true);
      if (!merged.ok) throw Error(merged.message);
      const revision = state.baseRevision + 1,
        savedAt = `2026-10-23T07:00:0${count}Z`;
      server = {
        authored: { ...merged.value.authored, revision },
        spatial: merged.value.spatial,
      };
      during?.();
      expect(state.pending!.command).toEqual(frozen);
      state = settleStudioSave(state, request, {
        kind: "success",
        receipt: { revision, savedAt, alreadyExisted: false },
      });
      const loaded = projectStudioAuthoringView(server);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw Error(loaded.message);
      expect(() =>
        reconcileStudioSaveBaseline(state, loaded.value, savedAt),
      ).not.toThrow();
      return loaded.value;
    };
    const copy = copyStudioSceneObject(state.edit, "p2");
    state = changeStudioSaveSession(
      state,
      pasteStudioSceneObject(state.edit, copy, "copyA", {
        persistedObjectIds: state.baselinePergolaIds!,
        baselineObjectOptions: state.baselineObjectOptions,
      }),
    );
    save();
    state = changeStudioSaveSession(
      state,
      removeStudioSceneObject(state.edit, "p2", {
        persistedObjectIds: state.baselinePergolaIds!,
      }),
    );
    if (timing === "pending")
      save(() => {
        state = navigateStudioSaveHistory(state, "undo").session;
      });
    else {
      save();
      state = navigateStudioSaveHistory(state, "undo").session;
    }
    const restored = save();
    expect(restored.objectOptions.map((r) => r.objectId)).toEqual([
      "copyA",
      "p2",
    ]);
    expect(state.dirty).toBe(false);
    state = navigateStudioSaveHistory(state, "redo").session;
    expect(save().objectOptions.map((r) => r.objectId)).toEqual(["copyA"]);
  },
);
it.each(
  [
    "blinds.items",
    "additionalAluminium.rows",
    "standaloneInfills.items",
    "flashings.rows",
    "infills.items",
  ].flatMap((collection) =>
    ["pending", "acknowledged"].map((timing) => ({ collection, timing })),
  ),
)(
  "retains canonical restored $collection row order during $timing rather than claiming the historical order was saved",
  ({ collection, timing }) => {
    const edit = view(),
      [section, key] = collection.split("."),
      site = ["blinds", "additionalAluminium", "standaloneInfills"].includes(
        section,
      ),
      container = site ? edit.site : edit.objectOptions[0].values;
    container[section] = { [key]: [{ id: "a" }, { id: "b" }] };
    let state = createStudioSaveSession(scope, edit, null),
      server = { authored: stored(state.edit), spatial: state.edit.spatial },
      count = 0;
    const save = (during?: () => void) => {
      const id = "rows-" + ++count;
      state = prepareStudioSave(state, id);
      const frozen = structuredClone(state.pending!.command);
      const merged = mergeStudioAuthoringEdit({
        storedAuthored: server.authored,
        storedSpatial: server.spatial,
        edit: frozen.edit,
      });
      expect(merged.ok).toBe(true);
      if (!merged.ok) throw Error(merged.message);
      const revision = state.baseRevision + 1,
        savedAt = `2026-10-23T07:01:0${count}Z`;
      server = {
        authored: { ...merged.value.authored, revision },
        spatial: merged.value.spatial,
      };
      during?.();
      expect(state.pending!.command).toEqual(frozen);
      state = settleStudioSave(state, id, {
        kind: "success",
        receipt: { revision, savedAt, alreadyExisted: false },
      });
      const loaded = projectStudioAuthoringView(server);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw Error(loaded.message);
      expect(() =>
        reconcileStudioSaveBaseline(state, loaded.value, savedAt),
      ).not.toThrow();
      return loaded.value;
    };
    const removed = structuredClone(state.edit),
      owner = site ? removed.site : removed.objectOptions[0].values;
    (owner[section] as any)[key] = [{ id: "b" }];
    removed.deletions.push(
      site
        ? { scope: "site", collection: collection as any, ids: ["a"] }
        : {
            scope: "object",
            objectId: removed.objectOptions[0].objectId,
            collection: collection as any,
            ids: ["a"],
          },
    );
    state = changeStudioSaveSession(state, removed);
    if (timing === "pending")
      save(() => {
        state = navigateStudioSaveHistory(state, "undo").session;
      });
    else {
      save();
      state = navigateStudioSaveHistory(state, "undo").session;
    }
    const loaded = save(),
      values = site ? loaded.site : loaded.objectOptions[0].values;
    expect((values[section] as any)[key].map((r: any) => r.id)).toEqual([
      "b",
      "a",
    ]);
    expect(state.dirty).toBe(false);
  },
);
