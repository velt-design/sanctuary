import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import {
  previewStudioAttachment,
  updateStudioHouse,
} from "@/lib/designStudio/studioHouseCommands";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import { websiteComposition } from "@/lib/designStudio/websiteComposition";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { useStudioConnectionTask } from "./useStudioConnectionTask";
import Controls from "./StudioHouseConnectionControls";
let task: ReturnType<typeof useStudioConnectionTask>,
  edit: StudioAuthoringEdit,
  mounted: ReturnType<typeof renderIntoDocument>;
function measure(row: ReturnType<typeof websiteComposition>[number]) {
  return row.attachment && "measurements" in row.attachment
    ? row.attachment.measurements
    : null;
}
let changes: number,
  navigate: ReturnType<typeof vi.fn<(request: unknown) => void>>;
afterEach(() => mounted?.unmount());
function setup(height = "4000", bound = false, width = "9500") {
  edit = studioAttachmentFixture(37, "hipped");
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    eaveHeightMm: height,
    wallHeightMm: height,
    widthMm: width,
  });
  if (bound)
    edit = previewStudioAttachment(edit, {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
    });
  changes = 0;
  navigate = vi.fn();
  const resolver = createStudioSceneResolver();
  function Harness() {
    const [value, setValue] = useState(edit),
      [location, setLocation] = useState({
        selected: "p2",
        section: "Shape" as const,
        mode: "options" as const,
        view: "3D" as const,
      });
    edit = value;
    const resolved = resolver.resolve(value);
    task = useStudioConnectionTask({
      edit: value,
      resolved,
      identity: { scopeKey: "test", epoch: "one", generation: changes },
      location,
      housePending: false,
      navigate: (request) => {
        navigate(request);
        setLocation(
          (current) => ({ ...current, ...request }) as typeof current,
        );
      },
      apply: (create, accepted) => {
        const next = create(edit);
        if (next !== edit) changes++;
        edit = next;
        setValue(next);
        accepted();
      },
    });
    return <Controls task={task} product={resolved.rows[0]} />;
  }
  mounted = renderIntoDocument(<Harness />);
}
it("applies the chosen method in one click on a real nearest edge, retaining optional edge choice and the current view", () => {
  setup();
  expect(
    [...mounted.container.querySelectorAll("button")].map((b) => b.textContent),
  ).toEqual(["Fa\u00e7ade", "Fascia", "Soffit", "Freestanding"]);
  act(() => task.dispatch({ kind: "method", method: "facade" }));
  expect(websiteComposition(edit)[0].value?.facadeClearanceMm).toBe("200");
  expect(task.binding?.method).toBe('facade');
  expect(changes).toBe(1);
  expect(task.choice).toBeNull();
  expect(task.preview.error).toBeNull();
  expect(navigate.mock.calls.every(([request]) => !Object.hasOwn(request as object, 'view'))).toBe(true);
  act(() =>
    task.dispatch({
      kind: "target",
      target: task.targets.find((t) => t.side === "rear")!,
    }),
  );
  const row = websiteComposition(edit)[0];
  expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(200);
  expect(task.choice).toBeNull();
  expect(navigate).toHaveBeenLastCalledWith({
    selected: "p2",
    mode: "options",
    section: "Shape",
  });
});
it("shows actual legacy clearance without migrating geometry, then applies one raw edit and retains custom clearance across method cycling and freestanding", () => {
  setup("4000", true);
  const before = websiteComposition(edit)[0];
  expect(before.value?.facadeClearanceMm).toBeUndefined();
  expect(
    Number(
      (mounted.container.querySelector("input") as HTMLInputElement).value,
    ),
  ).toBeCloseTo(measure(before)!.roofClearanceMm!, 1);
  act(() => task.dispatch({ kind: "clearance", raw: "700" }));
  expect(changes).toBe(1);
  expect(
    measure(websiteComposition(edit)[0])?.roofClearanceMm,
  ).toBeGreaterThanOrEqual(700);
  act(() => task.dispatch({ kind: "method", method: "fascia" }));
  expect(task.binding?.method).toBe("fascia");
  act(() => task.dispatch({ kind: "freestanding" }));
  expect(task.binding).toBeUndefined();
  expect(websiteComposition(edit)[0].value?.facadeClearanceMm).toBe("700");
  act(() => task.dispatch({ kind: "method", method: "facade" }));
  act(() =>
    task.dispatch({
      kind: "target",
      target: task.targets.find((t) => t.side === "rear")!,
    }),
  );
  expect(
    measure(websiteComposition(edit)[0])?.roofClearanceMm,
  ).toBeGreaterThanOrEqual(700);
});
it('uses the latest authored clearance after an immediate field commit, applies each method once and ignores an already valid selected method', () => {
  setup('2700');
  act(() => task.dispatch({ kind: 'method', method: 'soffit' }));
  const edge = task.binding!.edge;
  act(() => {
    task.dispatch({ kind: 'clearance', raw: '700' });
    task.dispatch({ kind: 'method', method: 'facade' });
  });
  expect(task.binding).toMatchObject({ method: 'facade', edge });
  const facade = websiteComposition(edit)[0];
  expect(facade.value!.facadeClearanceMm).toBe('700');
  expect(measure(facade)!.roofClearanceMm).toBeGreaterThanOrEqual(700);
  const count = changes;
  const before = structuredClone(edit);
  act(() => task.dispatch({ kind: 'method', method: 'facade' }));
  expect(edit).toEqual(before);
  expect(changes).toBe(count);
  act(() => {
    task.dispatch({ kind: 'method', method: 'fascia' });
    task.dispatch({ kind: 'method', method: 'soffit' });
  });
  expect(task.binding).toMatchObject({ method: 'soffit', edge });
  expect(websiteComposition(edit)[0].error).toBeNull();
  act(() => {
    task.dispatch({ kind: 'method', method: 'facade' });
    task.dispatch({ kind: 'method', method: 'soffit' });
  });
  expect(task.binding?.method).toBe('soffit');
});
it("keeps manual clearance edits fixed-house and their measured refusal and recovery before the lower fields", () => {
  setup("2700");
  act(() => task.dispatch({ kind: "method", method: "facade" }));
  const source = structuredClone(edit.spatial.houseAssembly);
  navigate.mockClear();
  act(() => task.dispatch({ kind: 'clearance', raw: '1700' }));
  expect(edit.spatial.houseAssembly).toEqual(source);
  expect(websiteComposition(edit)[0].error).toMatch(/2000.5000/);
  expect(mounted.container.querySelector("[role=alert]")?.textContent).toMatch(
    /2000.5000/,
  );
  expect(mounted.container.textContent).toContain("Check house height");
  const alert = mounted.container.querySelector("[role=alert]")!;
  const repair = [...mounted.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Check house height",
  )!;
  for (const field of mounted.container.querySelectorAll("input,select")) {
    expect(
      alert.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      repair.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
  expect(task.binding?.method).toBe('facade');
  act(() => task.dispatch({ kind: "cancel" }));
  expect(task.choice).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});
it("retains invalid raw and last attached reference, with dormant invalid preference allowing freestanding", () => {
  setup("4000", true);
  const before = websiteComposition(edit)[0].reference;
  act(() => task.dispatch({ kind: "clearance", raw: "199" }));
  expect(websiteComposition(edit)[0].error).toContain("200 mm");
  expect(websiteComposition(edit)[0].reference).toEqual(before);
  expect(
    mounted.container
      .querySelector("[role=alert]")!
      .compareDocumentPosition(mounted.container.querySelector("input")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  act(() => task.dispatch({ kind: "freestanding" }));
  expect(websiteComposition(edit)[0].value?.facadeClearanceMm).toBe("199");
  expect(websiteComposition(edit)[0].error).toBeNull();
});
it("prioritises the full span refusal and primary measured repair before lower connection fields", () => {
  setup("4000", false, "5000");
  act(() => task.dispatch({ kind: "method", method: "facade" }));
  act(() =>
    task.dispatch({
      kind: "target",
      target: task.targets.find((t) => t.side === "rear")!,
    }),
  );
  expect(task.preview.error).toBeTruthy();
  expect(mounted.container.textContent).toContain("Available house edge");
  const repair = [...mounted.container.querySelectorAll("button")].find(
    (b) => b.textContent === "Check house dimensions",
  )!;
  expect(repair).toBeTruthy();
  const edge = mounted.container.querySelector("select")!;
  expect(
    repair.compareDocumentPosition(edge) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    mounted.container
      .querySelector("[role=alert]")!
      .compareDocumentPosition(edge) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
