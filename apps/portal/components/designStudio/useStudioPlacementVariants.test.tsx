import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "@/lib/designStudio/authoringView";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import {
  changeStudioProduct,
  previewStudioAttachment,
  updateStudioHouse,
} from "@/lib/designStudio/studioHouseCommands";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import { websiteConnectionEdge } from "@/lib/designStudio/websiteConnectionEdge";
import {
  preparedStudioResources,
  studioPreparationReply,
} from "../../../../test/studioPlacementTestWorker";
import type { StudioPreparationRequest } from "./studioPlacementPreparation";
import { useStudioDirectPlacementHarness as useStudioDirectPlacement } from "../../../../test/studioPlacementHarness";
let mixedFixture: StudioAuthoringEdit | undefined;
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
let worker: TestWorker,
  api: ReturnType<typeof useStudioDirectPlacement>,
  current: StudioAuthoringEdit,
  replace: (e: StudioAuthoringEdit) => void,
  undo: () => void;
let mount: ReturnType<typeof renderIntoDocument> | undefined;
let requestLog: StudioPreparationRequest[] = [];
class TestWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  requests: StudioPreparationRequest[] = requestLog;
  terminated = false;
  constructor() {
    worker = this;
  }
  postMessage(r: StudioPreparationRequest) {
    this.requests.push(structuredClone(r));
  }
  terminate() {
    this.terminated = true;
  }
  reply(r = this.requests.at(-1)!) {
    this.onmessage?.({ data: studioPreparationReply(r) } as MessageEvent);
  }
  drain() {
    for (let n = 0; n < 20; n++) {
      const request = this.requests.at(-1)!;
      this.reply(request);
      if (request === this.requests.at(-1)) return;
    }
    throw Error("Preparation did not settle");
  }
}
function mixed() {
  if (mixedFixture) return structuredClone(mixedFixture);
  let e: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "mixed-placement-variants",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const h = applyStudioHouseEdit(e.spatial, { kind: "add", id: "house" });
  if (!h.ok) throw Error(h.message);
  e.spatial = h.spatial;
  // The reported movement failure used the ordinary low house. Valid attachment
  // fixtures below change its dimensions explicitly, only for those checks.
  const house = studioHouseScene(e.site, e.spatial)!.houses[0];
  e = updateStudioHouse(e, { ...house, widthMm: "8000" });
  for (const [
    id,
    family,
    intent,
    width,
    projection,
    x,
    y,
    rotation,
    finish,
    datum,
  ] of [
    [
      "box",
      "box",
      "freestanding",
      "6000",
      "3000",
      "3706.4",
      "4120.9",
      "0",
      "black",
      "2838",
    ],
    [
      "pitched",
      "mono",
      "attached",
      "6500",
      "3200",
      "11000",
      "0",
      "-360",
      "white",
      "2400",
    ],
    [
      "gable",
      "gable",
      "attached",
      "6000",
      "3000",
      "13072.7",
      "4114.9",
      "0",
      "black",
      "2400",
    ],
  ] as const) {
    e = addWebsitePergola(e, id);
    const v = websiteComposition(e).find((r) => r.object.id === id)!.value!;
    const roof = {
      ...v.selection.roof,
      family,
      orientation: "parallel" as const,
      frameFinish: finish,
    };
    if (intent === "freestanding") roof.attachmentIntent = "freestanding";
    e = changeStudioProduct(e, {
      ...v,
      supportDatumMm: datum,
      rawDimensions: { widthMm: width, projectionMm: projection },
      selection: { ...v.selection, roof },
    });
    e = positionWebsitePergola(e, id, {
      originXMm: x,
      originYMm: y,
      rotationDeg: rotation,
    });
  }
  mixedFixture = freeze(e);
  return structuredClone(mixedFixture);
}
function intent(e: StudioAuthoringEdit, id: string, free: boolean) {
  const v = websiteComposition(e).find((r) => r.object.id === id)!.value!,
    roof = { ...v.selection.roof };
  if (free) roof.attachmentIntent = "freestanding";
  else delete roof.attachmentIntent;
  return changeStudioProduct(e, { ...v, selection: { ...v.selection, roof } });
}
function only(e: StudioAuthoringEdit, ...ids: string[]): StudioAuthoringEdit {
  return {
    ...e,
    spatial: {
      ...e.spatial,
      pergolas: e.spatial.pergolas.filter((p) => ids.includes(p.id)),
    },
    objectOptions: e.objectOptions.filter((p) => ids.includes(p.objectId)),
  };
}
function open(initial: StudioAuthoringEdit) {
  function Harness() {
    const [e, set] = useState(initial),
      [previous, keep] = useState<StudioAuthoringEdit | null>(null);
    current = e;
    replace = set;
    undo = () => {
      if (previous) set(previous);
    };
    api = useStudioDirectPlacement(
      e,
      (next) => {
        keep(e);
        set(next);
      },
      false,
    );
    return null;
  }
  mount = renderIntoDocument(<Harness />);
  act(() => worker.drain());
}
beforeEach(() => {
  requestLog = [];
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  mount?.unmount();
  mount = undefined;
  vi.unstubAllGlobals();
});

it.each(["box", "pitched", "gable"])(
  "moves and cancels %s in the low-house mixed design; Box also commits, reloads and undoes",
  (id) => {
    const e = mixed(),
      box = websiteComposition(e)[0];
    expect(box.error).toBeNull();
    expect(() =>
      websiteConnectionEdge(
        solvePergolaPreview(
          box.design!.input,
          box.design!.roof,
          box.geometryOptions,
        ).geometry!.assembly,
      ),
    ).toThrow("no supported house connection datum");
    open(e);
    for (const id of ["box", "pitched", "gable"])
      expect(api.directDrag.canDrag!(id)).toBe(true);
    expect(api.message).toBeNull();
    const position = websiteComposition(current).find(
      (r) => r.object.id === id,
    )!.position!;
    act(() => api.directDrag.begin!(id));
    act(() =>
      api.directDrag.move(
        id,
        position.x + 600,
        position.y + 10000,
        { x: 0, y: 0 },
        1,
      ),
    );
    expect(api.proposal).toBeTruthy();
    act(() => api.directDrag.finish(false));
    expect(current).toEqual(e);
    if (id !== "box") return;
    const p = box.position!;
    act(() => api.directDrag.begin!("box"));
    act(() =>
      api.directDrag.move("box", p.x + 600, p.y + 10000, { x: 0, y: 0 }, 1),
    );
    const shown = api.proposal!;
    act(() => api.directDrag.finish(true));
    const moved = websiteComposition(current)[0];
    expect(moved.position).toMatchObject({ x: shown.x, y: shown.y });
    expect(moved.studioAttachment).toBeNull();
    expect(moved.value).toEqual(box.value);
    const loaded = parseStudioAuthoringEdit(
      JSON.parse(JSON.stringify(current)),
    );
    expect(loaded.ok).toBe(true);
    if (loaded.ok)
      expect(websiteComposition(loaded.value)[0].position).toEqual(
        moved.position,
      );
    act(undo);
    expect(current).toEqual(e);
  },
  20000,
);

it.each(
  ["box", "pitched", "gable"].flatMap((id) =>
    ["facade", "fascia", "soffit"].map((method) => ({ id, method })),
  ),
)(
  "retains real $id $method candidates and canonical refusal",
  ({ id, method }) => {
    // Each product's full candidate set is checked against the canonical command.
    // Unrelated products do not need to be solved again for each equivalence check.
    let e = only(mixed(), id);
    const house = studioHouseScene(e.site, e.spatial)!.houses[0];
    e = updateStudioHouse(e, {
      ...house,
      wallHeightMm: "3200",
      eaveHeightMm: "3200",
      roof: { ...house.roof, fasciaHeightMm: "350" },
    });
    const bank = preparedStudioResources(e).caches;
    if (id === "box" && method === "fascia") {
      expect(bank.get("box:fascia")!.candidates).toEqual([]);
      let refusal: string | undefined;
      try {
        previewStudioAttachment(e, {
          objectId: "box",
          houseId: "house",
          edge: "rear",
          kind: "eave",
          method: "fascia",
        });
      } catch (error) {
        refusal = (error as Error).message;
      }
      expect(refusal).toBeTruthy();
      expect(bank.get("box:fascia")!.unavailable).toBe(refusal);
      return;
    }
    const candidates = bank.get(`${id}:${method}`)!.candidates;
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      const canonical = websiteComposition(
        previewStudioAttachment(e, candidate.choice),
      ).find((row) => row.object.id === id)!;
      expect(candidate.pose).toEqual(canonical.position);
      expect(candidate.height).toEqual(
        canonical.geometryOptions?.supportDatumMm,
      );
      expect(candidate).not.toHaveProperty("edit");
    }
  },
  20000,
);

it("rebuilds after support intent changes, ignores old replies, and preserves pending readiness until the current pack arrives", () => {
  // This two-product shape mirrors the normal Gable free -> house-supported transition.
  let e = only(mixed(), "pitched", "gable");
  e = intent(e, "gable", true);
  open(e);
  expect(api.directDrag.canDrag!("gable")).toBe(true);
  const oldRequest = worker.requests.at(-1)!,
    count = worker.requests.length;
  act(() => replace(intent(current, "gable", false)));
  expect(worker.requests).toHaveLength(count + 1);
  expect(api.directDrag.canDrag!("gable")).toBe(true);
  expect(api.readiness("gable", "facade").kind).toBe("preparing");
  expect(api.readiness("pitched", "facade").kind).not.toBe("preparing");
  const requested = worker.requests.at(-1)!,
    beforeReplay = worker.requests.length;
  act(() => worker.reply(oldRequest));
  expect(worker.requests).toHaveLength(beforeReplay);
  expect(api.directDrag.canDrag!("gable")).toBe(true);
  act(() => worker.reply(requested));
  act(() => worker.drain());
  expect(api.directDrag.canDrag!("gable")).toBe(true);
  expect(api.directDrag.canDrag!("pitched")).toBe(true);
  expect(api.message).toBeNull();
  const afterCurrent = worker.requests.length;
  act(() => worker.reply(oldRequest));
  expect(worker.requests).toHaveLength(afterCurrent);
  expect(api.directDrag.canDrag!("gable")).toBe(true);
}, 20000);

it.each(["freestanding", "soffit"] as const)(
  "rebuilds the current %s variant without invalidating the other product",
  (variant) => {
    const e = only(mixed(), "pitched", "gable");
    open(e);
    const count = worker.requests.length,
      v = websiteComposition(current).find(
        (r) => r.object.id === "gable",
      )!.value!;
    const next =
      variant === "freestanding"
        ? intent(current, "gable", true)
        : changeStudioProduct(current, {
            ...v,
            selection: {
              ...v.selection,
              input: { ...v.selection.input, connection: "soffit" },
            },
          });
    act(() => replace(next));
    expect(worker.requests).toHaveLength(count + 1);
    expect(api.directDrag.canDrag!("gable")).toBe(true);
    act(() => worker.drain());
    expect(api.directDrag.canDrag!("gable")).toBe(true);
    expect(api.directDrag.canDrag!("pitched")).toBe(true);
  },
  20000,
);

it("shows current preparation and invalid-input failure instead of a stale successful placement message", () => {
  const e = only(mixed(), "pitched");
  open(e);
  act(() => api.directDrag.begin!("pitched"));
  act(() => api.directDrag.move("pitched", 20000, 20000, { x: 0, y: 0 }, 1));
  act(() => api.directDrag.finish(true));
  expect(api.message).toBe("Placement applied.");
  const v = websiteComposition(current)[0].value!;
  act(() =>
    replace(
      changeStudioProduct(current, {
        ...v,
        rawDimensions: { ...v.rawDimensions, widthMm: "bad" },
      }),
    ),
  );
  expect(api.message).toContain("positive whole millimetre");
  act(() => worker.drain());
  expect(api.message).toContain("positive whole millimetre");
  expect(api.directDrag.canDrag!("pitched")).toBe(false);
  act(() =>
    replace(
      changeStudioProduct(current, {
        ...v,
        rawDimensions: { ...v.rawDimensions, widthMm: "6500" },
      }),
    ),
  );
  act(() => worker.drain());
  expect(api.message).toBeNull();
  expect(api.directDrag.canDrag!("pitched")).toBe(true);
}, 20000);
