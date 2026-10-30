import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { WebsiteJoin } from "@/lib/designStudio/websiteJoinIntent";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
  transformWebsitePoint,
} from "@/lib/designStudio/websiteComposition";
import {
  previewWebsiteJoin,
  websiteJoinStates,
  websiteJoinTargets,
} from "@/lib/designStudio/websiteJoins";
import * as canonical from "@/lib/designStudio/websiteJoins";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import {
  previewStudioAttachment,
  changeStudioProduct,
} from "@/lib/designStudio/studioHouseCommands";
import { studioJoinCanvasProjection } from "./studioJoinPresentation";
import { useStudioJoinTask } from "./useStudioJoinTask";

function pair(rotation = 0) {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "join-task",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  edit = addWebsitePergola(addWebsitePergola(edit, "a"), "b");
  edit = positionWebsitePergola(edit, "a", { rotationDeg: String(rotation) });
  return positionWebsitePergola(edit, "b", {
    originXMm: "15000",
    originYMm: "1000",
    rotationDeg: String(rotation),
  });
}
const choice = (
  alignment: WebsiteJoin["alignment"] = "centre",
): WebsiteJoin => ({
  id: "join",
  a: { objectId: "b", edge: "left" },
  b: { objectId: "a", edge: "right" },
  alignment,
});
it("submits a completed target choice immediately without a second generic confirmation", () => {
  const edit = pair(), apply = vi.fn();
  let task!: ReturnType<typeof useStudioJoinTask>;
  mounted = renderIntoDocument(<Test />);
  function Test() {
    task = useStudioJoinTask({edit, identity:{scopeKey:"one",epoch:"one",generation:0},objectId:"b",active:true,navigate:()=>{},apply,change:()=>{}});
    return null;
  }
  act(()=>task.dispatch({kind:"start"}));
  act(()=>task.dispatch({kind:"edge",edge:"left"}));
  expect(apply).not.toHaveBeenCalled();
  act(()=>task.dispatch({kind:"target",id:"a",edge:"right"}));
  expect(apply).toHaveBeenCalledOnce();
  expect(apply.mock.calls[0][0](edit)).toEqual(previewWebsiteJoin(edit,task.draft!).edit);
});
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.restoreAllMocks();
});

/** Frozen pre-refactor Canvas expressions, kept only as the parity oracle. */
function oldProjection(
  edit: StudioAuthoringEdit,
  draft: WebsiteJoin | null,
  preview: StudioAuthoringEdit | null,
) {
  const targets = draft ? websiteJoinTargets(edit, draft.a.objectId) : [];
  const r =
    draft && preview
      ? websiteComposition(preview).find(
          (p) => p.object.id === draft.a.objectId,
        )
      : null;
  const g =
    r?.design && r.position
      ? solvePergolaPreview(r.design.input, r.design.roof, r.geometryOptions)
          .geometry
      : null;
  return {
    active: !!draft,
    targets,
    proposed:
      g && r
        ? {
            label: r.object.label,
            points: g.plan.outline.map((p) =>
              transformWebsitePoint(p, r.position!),
            ),
          }
        : null,
  };
}
it.each(
  [0, 37].flatMap((rotation) =>
    (["start", "centre", "end"] as const).map((alignment) => ({
      rotation,
      alignment,
    })),
  ),
)(
  "preserves complete canonical target/ghost fields at $rotation / $alignment",
  ({ rotation, alignment }) => {
    const edit = pair(rotation),
      before = structuredClone(edit),
      draft = choice(alignment),
      preview = previewWebsiteJoin(edit, draft).edit;
    expect(studioJoinCanvasProjection(edit, draft, preview)).toEqual(
      oldProjection(edit, draft, preview),
    );
    expect(studioJoinCanvasProjection(edit, draft, null)).toEqual(
      oldProjection(edit, draft, null),
    );
    expect(studioJoinCanvasProjection(edit, null, preview)).toEqual(
      oldProjection(edit, null, preview),
    );
    expect(edit).toEqual(before);
  },
);
it("preserves roof/options, attached/free targets and invalid-peer filtering without a new physical formula", () => {
  const attached = previewStudioAttachment(studioAttachmentFixture(37), {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
    alongEdgeMm: 925,
  });
  let edit = addWebsitePergola(attached, "b");
  const draft = { ...choice(), b: { objectId: "p2", edge: "right" as const } };
  const value = structuredClone(
    websiteComposition(edit).find((p) => p.object.id === "b")!.value!,
  );
  value.selection.roof.family = "gable";
  value.supportDatumMm = "2750";
  edit = changeStudioProduct(edit, value);
  // Even when the canonical join refuses, standalone projection retains the old
  // outline arguments and target availability for that exact supplied preview.
  expect(studioJoinCanvasProjection(edit, draft, edit)).toEqual(
    oldProjection(edit, draft, edit),
  );
  const broken = structuredClone(
    websiteComposition(edit).find((p) => p.object.id === "p2")!.value!,
  );
  broken.rawDimensions.widthMm = "-";
  const invalid = changeStudioProduct(edit, broken);
  expect(studioJoinCanvasProjection(invalid, draft, null)).toEqual(
    oldProjection(invalid, draft, null),
  );
});
it("drives join/reposition/remove without presentation, revalidates current state and retires only accepted intent", () => {
  let edit = pair(),
    generation = 0,
    epoch = "one",
    active = true;
  let task!: ReturnType<typeof useStudioJoinTask>,
    created:
      | ((current: StudioAuthoringEdit) => StudioAuthoringEdit)
      | undefined,
    accepted: (() => void) | undefined;
  const navigate = vi.fn(),
    change = vi.fn();
  function Harness() {
    task = useStudioJoinTask({
      edit,
      identity: { scopeKey: "scope", epoch, generation },
      objectId: "b",
      active,
      navigate,
      change,
      apply: (create, done) => {
        created = create;
        accepted = done;
      },
    });
    return null;
  }
  mounted = renderIntoDocument(<Harness />);
  const cancel = task.cancel;
  act(() => task.dispatch({ kind: "start" }));
  expect(navigate).toHaveBeenLastCalledWith({ view: "Plan" });
  expect(task.draft!.a).toEqual({ objectId: "b", edge: "right" });
  act(() => task.dispatch({ kind: "edge", edge: "left" }));
  act(() => task.dispatch({ kind: "target", id: "a", edge: "right" }));
  expect(task.preview.edit).toBeTruthy();
  expect(edit).toEqual(pair());
  const calls = vi.spyOn(canonical, "websiteJoinStates"),
    targets = vi.spyOn(canonical, "websiteJoinTargets");
  for (let i = 0; i < 3; i++) mounted.rerender(<Harness />);
  expect(calls).not.toHaveBeenCalled();
  expect(targets).not.toHaveBeenCalled();
  expect(created).toBeTypeOf("function");
  expect(task.draft).not.toBeNull();
  const current = positionWebsitePergola({ ...edit, revision: 2 }, "a", {
    originXMm: "2100",
    rotationDeg: "37",
  });
  const result = created!(current);
  expect(result).toEqual(previewWebsiteJoin(current, task.draft!).edit);
  expect(result.revision).toBe(2);
  act(() => {
    edit = result;
    generation++;
    accepted!();
  });
  mounted.rerender(<Harness />);
  expect(task.draft).toBeNull();
  expect(navigate).toHaveBeenLastCalledWith({ mode: "position" });
  const state = websiteJoinStates(edit)[0];
  expect(task.panel.states).toEqual([
    {
      id: state.join.id,
      label: state.label,
      error: state.error,
      canReposition: true,
    },
  ]);
  act(() => task.dispatch({ kind: "reposition", id: state.join.id }));
  expect(task.draft).toEqual(state.join);
  act(() => task.dispatch({ kind: "alignment", alignment: "end" }));
  expect(task.draft!.alignment).toBe("end");
  act(() => task.dispatch({ kind: "cancel" }));
  act(() => task.dispatch({ kind: "remove", id: state.join.id }));
  expect(change.mock.calls[0][0].spatial).toEqual(edit.spatial);
  expect(change.mock.calls[0][0].site.websiteJoins.joins).toEqual([]);
  act(() => task.dispatch({ kind: "start" }));
  epoch = "two";
  mounted.rerender(<Harness />);
  expect(task.draft).toBeNull();
  expect(task.cancel).toBe(cancel);
  act(() => task.dispatch({kind:"start"}));
  expect(task.draft).not.toBeNull();
  act(() => cancel());expect(task.draft).toBeNull();
  active = false;
  calls.mockClear();
  mounted.rerender(<Harness />);
  expect(calls).not.toHaveBeenCalled();
});
it("keeps exact canonical refusal and live command refusal without optimistic cleanup", () => {
  let edit = pair(),
    task!: ReturnType<typeof useStudioJoinTask>;
  let create!: (edit: StudioAuthoringEdit) => StudioAuthoringEdit;
  function Harness() {
    task = useStudioJoinTask({
      edit,
      identity: { scopeKey: "scope", epoch: "one", generation: 0 },
      objectId: "b",
      active: true,
      navigate: () => {},
      change: () => {},
      apply: (fn) => {
        create = fn;
      },
    });
    return null;
  }
  mounted = renderIntoDocument(<Harness />);
  act(() => task.dispatch({ kind: "start" }));
  act(() => task.dispatch({ kind: "edge", edge: "left" }));
  act(() => task.dispatch({ kind: "target", id: "missing", edge: "right" }));
  expect(task.preview).toEqual({
    edit: null,
    error: "Choose two available pergolas.",
  });
  act(() => task.dispatch({ kind: "target", id: "a", edge: "right" }));
  const invalid = structuredClone(edit);
  invalid.spatial.pergolas = invalid.spatial.pergolas.filter(
    (p) => p.id !== "a",
  );
  expect(() => create(invalid)).toThrow("Choose two available pergolas.");
  expect(task.draft).not.toBeNull();
  edit = invalid;
  mounted.rerender(<Harness />);
  expect(task.preview.error).toBe("Choose two available pergolas.");
});
it.each(["canonical-and-companion", "canonical-only"])(
  "preserves %s attached-moving disable and refusal distinctions",
  (form) => {
    let edit = addWebsitePergola(
      previewStudioAttachment(studioAttachmentFixture(37), {
        objectId: "p2",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
        alongEdgeMm: 925,
      }),
      "other",
    );
    if (form === "canonical-only") edit = { ...edit, site: {} };
    let task!: ReturnType<typeof useStudioJoinTask>;
    function Harness() {
      task = useStudioJoinTask({
        edit,
        identity: { scopeKey: "scope", epoch: "one", generation: 0 },
        objectId: "p2",
        active: true,
        navigate: () => {},
        change: () => {},
        apply: () => {
          throw Error("Refused preview must not commit");
        },
      });
      return null;
    }
    mounted = renderIntoDocument(<Harness />);
    expect(task.panel.canStart).toBe(false);
    act(() => task.dispatch({ kind: "start" }));
    act(() => task.dispatch({ kind: "target", id: "other", edge: "left" }));
    expect(task.preview.edit).toBeNull();
    expect(task.preview.error).toContain("attached to the house");
    expect(task.panel.canCommit).toBe(false);
    expect(task.draft).not.toBeNull();
  },
);
it("keeps canonical invalid-row messages and stored moving identity when repositioning from the target", () => {
  const joined = previewWebsiteJoin(pair(), choice()).edit;
  const value = structuredClone(
    websiteComposition(joined).find((p) => p.object.id === "b")!.value!,
  );
  value.rawDimensions.widthMm = "-";
  const edit = changeStudioProduct(joined, value),
    expected = websiteJoinStates(edit)[0];
  let task!: ReturnType<typeof useStudioJoinTask>;
  function Harness() {
    task = useStudioJoinTask({
      edit,
      identity: { scopeKey: "scope", epoch: "one", generation: 0 },
      objectId: "a",
      active: true,
      navigate: () => {},
      change: () => {},
      apply: () => {},
    });
    return null;
  }
  mounted = renderIntoDocument(<Harness />);
  expect(task.panel.states[0].error).toBe(expected.error);
  expect(expected.error).toContain("positive whole millimetre");
  act(() => task.dispatch({ kind: "reposition", id: "join" }));
  expect(task.draft).toEqual(choice());
  expect(task.panel.draft!.movingLabel).toBe(joined.spatial.pergolas[1].label);
});
