import { projectStudioPreparedMethod } from "./preparedAttachmentProjection";
import { expect, it, vi } from "vitest";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "../../drawings/state/objectFirstWorkbenchModel";
import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "../authoringView";
import { applyStudioHouseEdit } from "../houseEditing";
import { studioHouseScene } from "../studioHouseScene";
import {
  changeStudioProduct,
  previewStudioAttachment,
  updateStudioHouse,
} from "../studioHouseCommands";
import {
  addWebsitePergola,
  positionWebsitePergola,
  transformWebsitePoint,
  websiteComposition,
} from "../websiteComposition";
import { websiteProductPhysical } from "../websiteProductPhysical";
import { previewWebsiteJoin } from "../websiteJoins";
import { studioHouseTargets } from "../studioHouseGeometry";
import { websiteSoffitTarget } from "../studioHouseWebsiteContact";
import * as commands from "../studioHouseCommands";
import * as physical from "../websiteProductPhysical";
import * as attachmentEvaluation from "../studioAttachmentResolver";
import * as clearanceEvaluation from "../demoContactClearance";
import { createStudioSceneResolver } from "./resolvedScene";
import { physicalFootprint } from "./finitePlacement";
import { prepareStudioPlacement, studioPreparationTasks } from "./preparation";
import { studioPlacementResources } from "./placementResources";

function fixture(attached = false) {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "descriptor-proof",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "8000",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: { ...house.roof, fasciaHeightMm: "350" },
  });
  edit = addWebsitePergola(edit, "p");
  return attached
    ? previewStudioAttachment(edit, {
        objectId: "p",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
      })
    : edit;
}
const ready = (task: ReturnType<typeof studioPreparationTasks>[number]) => {
  const result = prepareStudioPlacement(task);
  if (result.kind !== "ready") throw Error(result.reason);
  return result.value;
};
function exactInput(edit: StudioAuthoringEdit) {
  const parsed = parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));
  if (!parsed.ok) throw Error(parsed.message);
  return parsed.value;
}
function pointEqual(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
) {
  expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  expect(a.x).toBeCloseTo(b.x, 7);
  expect(a.y).toBeCloseTo(b.y, 7);
  if (b.z !== undefined) expect(a.z).toBe(b.z);
}

it.each(
  [false, true].flatMap((hostOnly) =>
    [0, 37, 280, -200, 540].map((rotation) => ({ hostOnly, rotation })),
  ),
)(
  "matches canonical candidates cold and warm at $rotation degrees, canonical host only=$hostOnly",
  ({ hostOnly, rotation }) => {
    let base = fixture(true);
    if (hostOnly) delete base.site.websiteAttachments;
    const resolver = createStudioSceneResolver(),
      original = resolver.resolve(exactInput(base));
    const originalTasks = studioPreparationTasks(original).filter(
      (task) => task.method !== "fascia",
    );
    const warm = originalTasks.map(ready);
    const house = studioHouseScene(base.site, base.spatial)!.houses[0];
    const moved = exactInput(
      updateStudioHouse(base, {
        ...house,
        position: { xMm: "1234", yMm: "5678", rotationDeg: String(rotation) },
      }),
    );
    const current = resolver.resolve(moved),
      tasks = studioPreparationTasks(current).filter(
        (task) => task.method !== "fascia",
      );
    expect(tasks.map((task) => task.dependencyKey)).toEqual(
      originalTasks.map((task) => task.dependencyKey),
    );
    for (const [index, task] of tasks.entries()) {
      const cold = ready(task),
        currentHouse = current.houseRecords[0].house!;
      for (const descriptor of [warm[index], cold]) {
        const fit = vi.spyOn(attachmentEvaluation, "evaluateStudioAttachment"),
          clearance = vi.spyOn(clearanceEvaluation, "evaluateDemoClearance");
        const projected = projectStudioPreparedMethod(
          descriptor,
          task,
          current,
        );
        expect(fit).not.toHaveBeenCalled();
        expect(clearance).not.toHaveBeenCalled();
        fit.mockRestore();
        clearance.mockRestore();
        expect(projected.candidates.length).toBeGreaterThan(0);
        for (const candidate of projected.candidates) {
          const next = previewStudioAttachment(moved, candidate.choice),
            canonical = websiteComposition(next)[0];
          expect(Object.keys(candidate.pose).sort()).toEqual(
            Object.keys(canonical.position!).sort(),
          );
          pointEqual(candidate.pose, canonical.position!);
          expect(candidate.pose.rotation).toBeCloseTo(
            canonical.position!.rotation,
            8,
          );
          expect(candidate.height).toBe(
            canonical.geometryOptions?.supportDatumMm,
          );
          expect(candidate.canonicalHost).toEqual(
            canonical.object.attachment?.host,
          );
          const hull = physicalFootprint(
            websiteProductPhysical(canonical).points,
          ).map((point) => transformWebsitePoint(point, canonical.position!));
          expect(candidate.points).toHaveLength(hull.length);
          candidate.points.forEach((point, i) => pointEqual(point, hull[i]));
          const target =
            task.method === "soffit"
              ? websiteSoffitTarget(currentHouse, candidate.choice.edge)
              : studioHouseTargets(currentHouse, task.method).find(
                  (target) =>
                    target.side === candidate.choice.edge &&
                    target.kind === candidate.choice.kind,
                )!;
          pointEqual(candidate.target.start, target.start);
          pointEqual(candidate.target.end, target.end);
          pointEqual(candidate.target.centre, target.centre);
          expect(candidate).not.toHaveProperty("edit");
        }
      }
    }
  },
  20000,
);

it("world projection performs zero canonical solve/command/physical rebuild and refuses a shape-mismatched descriptor", () => {
  const edit = fixture(),
    resolver = createStudioSceneResolver(),
    scene = resolver.resolve(edit),
    task = studioPreparationTasks(scene)[0],
    descriptor = ready(task);
  const physicalSpy = vi.spyOn(physical, "websiteProductPhysical"),
    canonicalSpy = vi.spyOn(commands, "resolveStudioAttachment"),
    fitSpy = vi.spyOn(attachmentEvaluation, "evaluateStudioAttachment"),
    clearanceSpy = vi.spyOn(clearanceEvaluation, "evaluateDemoClearance");
  projectStudioPreparedMethod(descriptor, task, scene);
  expect(physicalSpy).not.toHaveBeenCalled();
  expect(canonicalSpy).not.toHaveBeenCalled();
  expect(fitSpy).not.toHaveBeenCalled();
  expect(clearanceSpy).not.toHaveBeenCalled();
  fitSpy.mockRestore();
  clearanceSpy.mockRestore();
  physicalSpy.mockRestore();
  canonicalSpy.mockRestore();
  const value = scene.rows[0].value!;
  const changed = changeStudioProduct(edit, {
    ...value,
    rawDimensions: { ...value.rawDimensions, widthMm: "6500" },
  });
  const newScene = resolver.resolve(changed),
    newTask = studioPreparationTasks(newScene)[0];
  expect(() =>
    projectStudioPreparedMethod(descriptor, newTask, newScene),
  ).toThrow("another shape or method");
});

it("isolates an invalid product and house while keeping a valid peer's methods and free movement usable", () => {
  let edit = addWebsitePergola(fixture(), "invalid");
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "invalid-house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const invalidValue = websiteComposition(edit).find(
    (row) => row.object.id === "invalid",
  )!.value!;
  edit = changeStudioProduct(edit, {
    ...invalidValue,
    rawDimensions: { ...invalidValue.rawDimensions, widthMm: "bad" },
  });
  edit.spatial.houseAssembly!.houseForms[1].wallHeightM = "bad";
  edit = exactInput(edit);
  const scene = createStudioSceneResolver().resolve(edit),
    tasks = studioPreparationTasks(scene);
  expect(tasks.every((task) => task.objectId === "p")).toBe(true);
  const results = new Map(
    tasks.map((task) => [task.dependencyKey, prepareStudioPlacement(task)]),
  );
  const resources = studioPlacementResources(scene, scene, tasks, results);
  expect(resources.operations.get("p:freeMove")).toEqual({ kind: "ready" });
  expect(resources.operations.get("p:facade")).toEqual({ kind: "ready" });
  expect(resources.operations.get("invalid:freeMove")).toMatchObject({
    kind: "refused",
  });
  const descriptor = ready(tasks[0]);
  expect(descriptor.refusals).toEqual([
    {
      houseId: "invalid-house",
      reason: "Enter a valid wall height. Your input is kept.",
    },
  ]);
  expect(
    descriptor.candidates.every(
      (candidate) => candidate.choice.houseId === "house",
    ),
  ).toBe(true);
});

it("rechecks current join consequences after a peer moves without rebuilding unrelated candidate geometry", () => {
  let edit = addWebsitePergola(addWebsitePergola(fixture(), "a"), "b");
  edit = previewWebsiteJoin(edit, {
    id: "join",
    a: { objectId: "b", edge: "left" },
    b: { objectId: "a", edge: "right" },
    alignment: "centre",
  }).edit;
  const resolver = createStudioSceneResolver(),
    original = resolver.resolve(edit),
    task = studioPreparationTasks(original).find(
      (task) => task.objectId === "p" && task.method === "facade",
    )!;
  const descriptor = ready(task);
  expect(
    projectStudioPreparedMethod(descriptor, task, original).candidates.every(
      (candidate) => candidate.consequences.length === 0,
    ),
  ).toBe(true);
  const moved = resolver.resolve(
    positionWebsitePergola(edit, "b", { originXMm: "40000" }),
  );
  const currentTask = studioPreparationTasks(moved).find(
    (candidate) => candidate.objectId === "p" && candidate.method === "facade",
  )!;
  expect(currentTask.dependencyKey).toBe(task.dependencyKey);
  expect(
    projectStudioPreparedMethod(
      descriptor,
      currentTask,
      moved,
    ).candidates.every(
      (candidate) =>
        candidate.consequences.length === 1 &&
        candidate.consequences[0].endsWith(": needs repair"),
    ),
  ).toBe(true);
});

it("rejects stale or incomplete method DTOs without a ready fallback", () => {
  const edit = fixture(),
    scene = createStudioSceneResolver().resolve(edit),
    task = studioPreparationTasks(scene)[0],
    descriptor = ready(task);
  expect(descriptor.version).toBe("studio.placement-method.v3");
  expect(JSON.parse(task.dependencyKey)[0]).toBe(descriptor.version);
  expect(descriptor.candidates.length).toBeGreaterThan(0);
  const old = structuredClone(descriptor) as any;
  old.version = "studio.placement-method.v1";
  const missing = structuredClone(descriptor) as any;
  delete missing.candidates[0].canonicalAtZero;
  const incomplete = structuredClone(descriptor) as any;
  incomplete.candidates[0].canonicalAtZero = { error: null };
  const malformed = structuredClone(descriptor) as any;
  malformed.candidates[0].canonicalAtZero.geometryOptions = {
    supportDatumMm: NaN,
  };
  const missingMeasurement = structuredClone(descriptor) as any;
  missingMeasurement.candidates[0].canonicalAtZero.measurements = null;
  const missingTargetPoint = structuredClone(descriptor) as any;
  delete missingTargetPoint.candidates[0].canonicalAtZero.target.start;
  for (const dto of [
    old,
    missing,
    incomplete,
    malformed,
    missingMeasurement,
    missingTargetPoint,
  ]) {
    expect(() => projectStudioPreparedMethod(dto, task, scene)).toThrow();
    const resources = studioPlacementResources(
      scene,
      scene,
      [task],
      new Map([[task.dependencyKey, { kind: "ready", value: dto }]]),
    );
    expect(resources.operations.get("p:facade")?.kind).toBe("refused");
    expect(resources.caches.get("p:facade")?.candidates).toHaveLength(0);
  }
});

it('carries explicit new Façade clearance through structured worker DTOs and refuses stale custom geometry',()=>{
 let edit=fixture(),value=websiteComposition(edit)[0].value!;
 const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];edit=updateStudioHouse(edit,{...house,eaveHeightMm:'4000',wallHeightMm:'4000'});
 edit=changeStudioProduct(edit,{...value,facadeClearanceMm:'700'});
 const resolver=createStudioSceneResolver(),scene=resolver.resolve(edit),task=studioPreparationTasks(scene).find(t=>t.method==='facade')!;
 const descriptor=structuredClone(ready(task)),projected=projectStudioPreparedMethod(descriptor,task,scene);
 expect(projected.candidates.length).toBeGreaterThan(0);expect(projected.candidates.every(c=>c.choice.facadeClearanceMm==='700')).toBe(true);
 expect(descriptor.candidates.every(c=>c.canonicalAtZero.error||c.canonicalAtZero.measurements!.roofClearanceMm!>=700)).toBe(true);
 const changed=changeStudioProduct(edit,{...websiteComposition(edit)[0].value!,facadeClearanceMm:'200'}),nextScene=resolver.resolve(changed),next=studioPreparationTasks(nextScene).find(t=>t.method==='facade')!;
 expect(next.dependencyKey).not.toBe(task.dependencyKey);expect(()=>projectStudioPreparedMethod(descriptor,next,nextScene)).toThrow();
 const forged=structuredClone(descriptor);forged.candidates[0].choice.facadeClearanceMm='200';expect(()=>projectStudioPreparedMethod(forged,task,scene)).toThrow();
});
it('keeps legacy Façade placement absent only on its retained actual edge and authors 200 for a new edge',()=>{
 const scene=createStudioSceneResolver().resolve(fixture(true)),task=studioPreparationTasks(scene).find(t=>t.method==='facade')!,descriptor=ready(task);
 expect(task.retainedFacade).toEqual({houseId:'house',edge:'rear'});
 expect(descriptor.candidates.find(c=>c.choice.edge==='rear')!.choice.facadeClearanceMm).toBeUndefined();
 expect(descriptor.candidates.filter(c=>c.choice.edge!=='rear').every(c=>c.choice.facadeClearanceMm==='200')).toBe(true);
});
