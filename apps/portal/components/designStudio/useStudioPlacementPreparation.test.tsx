import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import { changeStudioProduct } from "@/lib/designStudio/studioHouseCommands";
import { projectStudioPreparedMethod } from "@/lib/designStudio/interaction/preparedAttachmentProjection";
import { useStudioDirectPlacementHarness as useStudioDirectPlacement } from "../../../../test/studioPlacementHarness";
import {
  studioPreparationReply,
  preparedStudioResources,
} from "../../../../test/studioPlacementTestWorker";
import type { StudioPreparationRequest } from "./studioPlacementPreparation";

let worker: TestWorker,
  current: StudioAuthoringEdit,
  replace: (edit: StudioAuthoringEdit) => void;
let api: ReturnType<typeof useStudioDirectPlacement>,
  mount: ReturnType<typeof renderIntoDocument> | undefined;
let requests: StudioPreparationRequest[];
class TestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor() {
    worker = this;
  }
  postMessage(request: StudioPreparationRequest) {
    requests.push(structuredClone(request));
  }
  terminate() {
    this.terminated = true;
  }
  reply(request = requests.at(-1)!) {
    this.onmessage?.({ data: studioPreparationReply(request) } as MessageEvent);
  }
  drain() {
    for (let n = 0; n < 10; n++) {
      const last = requests.at(-1)!;
      this.reply(last);
      if (last === requests.at(-1)) return;
    }
    throw Error("Preparation did not settle");
  }
}
function initial() {
  const edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "raw-geometry-proof",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = addWebsitePergola(edit, "p"),
    value = websiteComposition(added)[0].value!;
  return changeStudioProduct(added, {
    ...value,
    selection: {
      ...value.selection,
      roof: {
        ...value.selection.roof,
        attachmentIntent: "freestanding",
        roofBattens: {
          profile: "39x39",
          edge: false,
          gap: 50,
          customGap: true,
        },
      },
    },
  });
}
function Harness() {
  const [edit, setEdit] = useState(initial);
  current = edit;
  replace = setEdit;
  api = useStudioDirectPlacement(edit, setEdit, false);
  return null;
}
function open() {
  mount = renderIntoDocument(<Harness />);
  act(() => worker.drain());
}
function raw(field: "widthMm" | "projectionMm" | "roof", value: string) {
  const previous = websiteComposition(current)[0].value!;
  return changeStudioProduct(
    current,
    field === "roof"
      ? { ...previous, rawGaps: { ...previous.rawGaps, roof: value } }
      : {
          ...previous,
          rawDimensions: { ...previous.rawDimensions, [field]: value },
        },
  );
}
beforeEach(() => {
  requests = [];
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  mount?.unmount();
  mount = undefined;
  vi.unstubAllGlobals();
});

it.each([
  ["widthMm", "6500"],
  ["projectionMm", "3500"],
  ["roof", "75"],
] as const)(
  "prepares the complete requested %s input and rejects the former descriptor",
  (field, value) => {
    open();
    const old = preparedStudioResources(current),
      oldTask = old.tasks[0],
      oldResult = old.results.get(oldTask.dependencyKey)!;
    if (oldResult.kind !== "ready") throw Error(oldResult.reason);
    const edited = raw(field, value),
      count = requests.length;
    act(() => replace(edited));
    expect(requests).toHaveLength(count + 1);
    const requested = requests.at(-1)!;
    expect(requested.task.value).toEqual(websiteComposition(edited)[0].value);
    expect(requested.task.dependencyKey).not.toBe(oldTask.dependencyKey);
    const fresh = preparedStudioResources(edited);
    expect(() =>
      projectStudioPreparedMethod(oldResult.value, fresh.tasks[0], fresh.scene),
    ).toThrow("another shape or method");
    expect(api.directDrag.canDrag!("p")).toBe(true);
    act(() => worker.drain());
    expect(api.message).toBeNull();
    act(() => api.directDrag.begin!("p"));
    expect(api.footprint!.original).toEqual(
      fresh.caches.get("p:facade")!.original,
    );
    expect(websiteComposition(current)[0].design).toEqual(
      websiteComposition(edited)[0].design,
    );
    if (field === "roof")
      expect(websiteComposition(current)[0].design!.roof.roofBattens!.gap).toBe(
        75,
      );
    else
      expect(websiteComposition(current)[0].design!.input[field]).toBe(
        Number(value),
      );
    act(() => api.directDrag.finish(false));
    expect(current).toEqual(edited);
  },
);

it("terminates obsolete shape work and refuses late replies from its old incarnation", () => {
  open();
  act(() => replace(raw("widthMm", "6500")));
  const oldWorker = worker,
    old = requests.at(-1)!;
  act(() => replace(raw("widthMm", "7000")));
  expect(oldWorker.terminated).toBe(true);
  const currentRequest = requests.at(-1)!;
  expect(currentRequest.incarnation).not.toBe(old.incarnation);
  act(() => oldWorker.reply(old));
  expect(api.readiness("p", "facade").kind).toBe("preparing");
  act(() => worker.drain());
  act(() => oldWorker.reply(old));
  expect(api.message).toBeNull();
  expect(websiteComposition(current)[0].design!.input.widthMm).toBe(7000);
  expect(api.directDrag.canDrag!("p")).toBe(true);
});

it("retains invalid raw input, refuses stale geometry and recovers with current valid input", () => {
  open();
  act(() => replace(raw("widthMm", "bad")));
  expect(api.directDrag.canDrag!("p")).toBe(false);
  expect(api.readiness("p", "freeMove").kind).toBe("refused");
  expect(api.message).toContain("positive whole millimetre");
  expect(websiteComposition(current)[0].value!.rawDimensions.widthMm).toBe(
    "bad",
  );
  act(() => replace(raw("widthMm", "6500")));
  act(() => worker.drain());
  expect(api.directDrag.canDrag!("p")).toBe(true);
  expect(api.message).toBeNull();
});

it("does zero preparation for product translation or rotation and keeps its new grabbed pose", () => {
  open();
  const count = requests.length;
  const moved = positionWebsitePergola(current, "p", {
    originXMm: "123",
    originYMm: "456",
    rotationDeg: "37",
  });
  act(() => replace(moved));
  expect(requests).toHaveLength(count);
  expect(api.directDrag.canDrag!("p")).toBe(true);
  act(() => api.directDrag.begin!("p"));
  expect(api.proposal).toMatchObject({ x: 123, y: 456 });
  act(() => api.directDrag.finish(false));
  expect(current).toEqual(moved);
});

it("keeps free movement available after a worker failure and reports only that operation", () => {
  mount = renderIntoDocument(<Harness />);
  act(() => worker.onerror?.(new ErrorEvent("error")));
  expect(api.directDrag.canDrag!("p")).toBe(true);
  expect(api.readiness("p", "freeMove")).toEqual({ kind: "ready" });
  expect(api.readiness("p", "facade")).toMatchObject({
    kind: "refused",
    reason: expect.stringContaining("could not be prepared"),
  });
  expect(api.readiness("p", "fascia").kind).toBe("preparing");
});
