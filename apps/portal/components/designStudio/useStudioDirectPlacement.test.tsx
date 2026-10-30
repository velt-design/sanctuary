import { act, useState } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import {
  addWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import {
  previewStudioAttachment,
  updateStudioHouse,
} from "@/lib/designStudio/studioHouseCommands";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import { previewStudioAttachmentAtAnchor } from "@/lib/designStudio/studioAttachmentPreview";
import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "@/lib/designStudio/authoringView";
import {
  preparedStudioResources,
  studioPreparationReply,
} from "../../../../test/studioPlacementTestWorker";
import {
  connectionDeparture,
  updateConnectionDeparture,
} from "@/lib/designStudio/interaction/gesturePreview";
import { createStudioPlacementController } from "@/lib/designStudio/interaction/placementController";
import type { StudioAttachmentProposal } from "./useStudioDirectPlacement";
import { useStudioDirectPlacementHarness as useStudioDirectPlacement } from "../../../../test/studioPlacementHarness";
let original: StudioAuthoringEdit, pending: StudioAttachmentProposal;
let api: ReturnType<typeof useStudioDirectPlacement>,
  current: StudioAuthoringEdit,
  currentPending: StudioAttachmentProposal | null,
  undo: () => void;
let mount: ReturnType<typeof renderIntoDocument> | undefined;
beforeAll(() => {
  original = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "gesture-proof",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const h = applyStudioHouseEdit(original.spatial, {
    kind: "add",
    id: "house",
  });
  if (!h.ok) throw Error(h.message);
  original.spatial = h.spatial;
  const house = studioHouseScene(original.site, original.spatial)!.houses[0];
  original = updateStudioHouse(original, {
    ...house,
    widthMm: "8000",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: { ...house.roof, fasciaHeightMm: "350" },
  });
  original = previewStudioAttachment(addWebsitePergola(original, "p"), {
    objectId: "p",
    houseId: "house",
    edge: "rear",
    kind: "eave",
    method: "soffit",
    alongEdgeMm: 500,
  });
  const row = websiteComposition(original)[0];
  pending = previewStudioAttachmentAtAnchor(
    original,
    { ...row.studioAttachment!, method: "fascia" },
    row.position!,
  );
}, 20000);
beforeEach(() => {
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((e: any) => void) | null = null;
      postMessage(request: any) {
        queueMicrotask(() =>
          this.onmessage?.({ data: studioPreparationReply(request) }),
        );
      }
      terminate() {}
    },
  );
});
afterEach(() => {
  mount?.unmount();
  mount = undefined;
  vi.unstubAllGlobals();
});
function Harness() {
  const [edit, setEdit] = useState(original),
    [proposal, setProposal] = useState<StudioAttachmentProposal | null>(
      pending,
    ),
    [previous, setPrevious] = useState<StudioAuthoringEdit | null>(null);
  api = useStudioDirectPlacement(
    edit,
    (next) => {
      setPrevious(edit);
      setEdit(next);
    },
    false,
    proposal,
    () => setProposal(null),
  );
  current = edit;
  currentPending = proposal;
  undo = () => {
    if (previous) {
      setEdit(previous);
      setPrevious(null);
    }
  };
  return null;
}
async function open() {
  mount = renderIntoDocument(<Harness />);
  await act(async () => {});
  expect(api.directDrag.canDrag!("p")).toBe(true);
}
it("starts at the visible pending pose, retains the committed outline and restores the proposal on cancel", async () => {
  await open();
  const pose = websiteComposition(pending.edit)[0].position!,
    bank = preparedStudioResources(original).caches;
  act(() => api.directDrag.begin!("p"));
  expect(api.proposal).toMatchObject({ x: pose.x, y: pose.y });
  expect(api.footprint!.original).toEqual(bank.get("p:fascia")!.original);
  expect(current).toBe(original);
  expect(api.directDrag.canDrag!("house")).toBe(false);
  act(() =>
    api.directDrag.move("p", pose.x + 50, pose.y + 10000, { x: 0, y: 0 }, 1),
  );
  act(() => api.directDrag.finish(false));
  expect(current).toBe(original);
  expect(currentPending).toBe(pending);
  expect(api.busy).toBe(false);
  expect(api.message).toContain("proposal restored");
});
it("notifies phase observers on acquisition, threshold and cancellation, without repeating them for held frames", () => {
  const cache = preparedStudioResources(original).caches.get("p:soffit")!,
    pose = websiteComposition(original)[0].position!,
    publish = vi.fn(),
    controller = createStudioPlacementController(() => ({
      session: {
        identity: { scopeKey: "phase-test", epoch: "phase-test", generation: 0 },
        transact: () => ({ kind: "refused", reason: "No commit in this cancellation test." }),
      },
      locked: false,
      pendingKey: null,
      acquire: () => ({ pose, cache, original: cache.original, pending: null }),
      publish,
      message: () => {},
      applied: () => {},
    })),
    phases: string[] = [],
    unsubscribe = controller.subscribePhase(() => phases.push(controller.phase)),
    pointer = (x: number) => ({ pointerId: 1, screen: { x, y: 0 }, world: { x: pose.x + x, y: pose.y }, units: 1 });
  controller.api.press("p", pointer(0));
  controller.api.move(pointer(3));
  expect(phases).toEqual(["pressed"]);
  controller.api.move(pointer(4));
  const heldPublications = publish.mock.calls.length;
  for (let x = 5; x <= 20; x++) controller.api.move(pointer(x));
  expect(publish.mock.calls.length).toBeGreaterThan(heldPublications);
  expect(phases).toEqual(["pressed", "dragging"]);
  controller.api.cancel();
  expect(phases).toEqual(["pressed", "dragging", "idle"]);
  controller.api.cancel();
  expect(phases).toHaveLength(3);
  unsubscribe();
  controller.api.press("p", pointer(0));
  controller.api.release(pointer(0));
  controller.dispose();
  expect(phases).toHaveLength(3);
});
it("detaches from the pending visible basis, commits once, reloads identically and Undo restores the complete original", async () => {
  await open();
  const pose = websiteComposition(pending.edit)[0].position!;
  act(() => api.directDrag.begin!("p"));
  act(() =>
    api.directDrag.move("p", pose.x + 50, pose.y + 10000, { x: 0, y: 0 }, 1),
  );
  const shown = api.proposal!;
  act(() => api.directDrag.finish(true));
  expect(currentPending).toBeNull();
  const row = websiteComposition(current)[0];
  expect(row.studioAttachment).toBeNull();
  expect(row.position).toMatchObject({
    x: shown.x,
    y: shown.y,
    rotation: pose.rotation,
  });
  const loaded = parseStudioAuthoringEdit(JSON.parse(JSON.stringify(current)));
  if (!loaded.ok) throw Error(loaded.message);
  expect(websiteComposition(loaded.value)[0].position).toEqual(row.position);
  act(() => undo());
  expect(current).toBe(original);
  expect(current).toEqual(original);
});
it("commits the exact attached preview on a tangent move with one complete Undo", async () => {
  await open();
  const pose = websiteComposition(pending.edit)[0].position!;
  act(() => api.directDrag.begin!("p"));
  act(() => api.directDrag.move("p", pose.x + 80, pose.y, { x: 0, y: 0 }, 1));
  const shown = api.proposal!.candidate!;
  expect(shown).toBeTruthy();
  act(() => api.directDrag.finish(true));
  expect(current).toEqual(previewStudioAttachment(original, shown.choice));
  expect(websiteComposition(current)[0].studioAttachment?.method).toBe(
    "fascia",
  );
  act(() => undo());
  expect(current).toBe(original);
});
it("uses the canonical binding for departure and retains the existing four-screen-pixel return threshold", () => {
  const cache = preparedStudioResources(original).caches.get("p:soffit")!,
    state = connectionDeparture(cache)!;
  expect(state).not.toBeNull();
  const point = (d: number) => ({
    x: state.start.x + state.n.x * d,
    y: state.start.y + state.n.y * d,
  });
  let p = point(100);
  expect(updateConnectionDeparture(state, p.x, p.y, 2)).toBe(state.key);
  p = point(93);
  expect(updateConnectionDeparture(state, p.x, p.y, 2)).toBe(state.key);
  p = point(92);
  expect(updateConnectionDeparture(state, p.x, p.y, 2)).toBeUndefined();
});
