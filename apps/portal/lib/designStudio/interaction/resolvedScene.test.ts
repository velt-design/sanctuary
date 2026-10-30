import { expect, it, vi } from "vitest";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "../../drawings/state/objectFirstWorkbenchModel";
import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "../authoringView";
import {
  attachWebsitePergola,
  detachWebsitePergola,
  websiteHouseTargets,
} from "../websiteAttachment";
import { applyStudioHouseEdit } from "../houseEditing";
import { studioHouseScene } from "../studioHouseScene";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
  transformWebsitePoint,
} from "../websiteComposition";
import {
  changeStudioProduct,
  previewStudioAttachment,
  updateStudioHouse,
} from "../studioHouseCommands";
import { createStudioSceneResolver } from "./resolvedScene";
import * as physical from "../websiteProductPhysical";
import * as houseGeometry from "../studioHouseGeometry";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import * as previewGeometry from "@sp/configurator/geometry";
import { DEFAULT_LIGHTING } from "@sp/configurator/website";
import { studioPreparationTasks } from './preparation';

function fixture(attached = false) {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "scene-proof",
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
        alongEdgeMm: 250,
      })
    : edit;
}
it("solves a current local product once for display, physical bounds and eligibility", () => {
  const edit = fixture(), solve = vi.spyOn(previewGeometry, "solvePergolaPreview");
  try {
    const resolver = createStudioSceneResolver(), scene = resolver.resolve(edit);
    expect(scene.products[0].geometry).toBeTruthy();
    expect(scene.products[0].physical!.points.length).toBeGreaterThan(0);
    expect(solve).toHaveBeenCalledTimes(1);
    expect(resolver.resolve(edit)).toBe(scene);
    expect(solve).toHaveBeenCalledTimes(1);
  } finally { solve.mockRestore(); }
});
it.each(["attached", "box", "gable"] as const)("keeps %s physical/collision output exact when using resolved geometry", kind => {
  let edit = fixture(kind === "attached");
  if (kind !== "attached") {
    const value = websiteComposition(edit)[0].value!;
    edit = changeStudioProduct(edit, { ...value, supportDatumMm: "3100", selection: { ...value.selection,
      roof: { ...value.selection.roof, family: kind, ...(kind === "box" ? { attachmentIntent: "freestanding" as const } : { orientation: "away" as const, infills: true }) },
    } });
  }
  const row = createStudioSceneResolver().resolve(edit).products[0];
  expect(row.error).toBeNull(); expect(row.geometry).toBeTruthy();
  expect(row.physical).toEqual(physical.websiteProductPhysical(row));
  expect(physical.websiteProductPhysical(row, true, row.geometry)).toEqual(physical.websiteProductPhysical(row, true));
  expect(() => physical.websiteProductPhysical(row, false, null)).toThrow("Product geometry unavailable.");
  expect(() => physical.websiteProductPhysical({ ...row, error: "Current row invalid" }, false, row.geometry)).toThrow("Current row invalid");
});
it('publishes current house materials while reusing exact local house and attached product artifacts',()=>{
  const edit=fixture(true),resolver=createStudioSceneResolver(),first=resolver.resolve(edit),next=structuredClone(edit);
  (next.spatial.houseAssembly!.houseForms[0] as any).appearance={wallMaterial:'brick',roofProfile:'corrugated',roofColour:'#334455'};
  const changed=resolver.resolve(next);
  expect(changed.houseRecords[0].error).toBeNull();
  expect(changed.houseRecords[0].geometry!.house.source).toEqual(next.spatial.houseAssembly!.houseForms[0]);
  expect(changed.houseRecords[0].geometry!.model).toBe(first.houseRecords[0].geometry!.model);
  expect(changed.houseRecords[0].shapeKey).toBe(first.houseRecords[0].shapeKey);
  expect(studioPreparationTasks(changed).map(task=>task.dependencyKey)).toEqual(studioPreparationTasks(first).map(task=>task.dependencyKey));
  expect(changed.products[0].geometry).toBe(first.products[0].geometry);
  expect(changed.products[0].physical).toEqual(first.products[0].physical);
});
it("reuses local artifacts across product/house rigid pose and matches canonical current placement", () => {
  const original = fixture(true),
    resolver = createStudioSceneResolver(),
    first = resolver.resolve(original);
  const house = studioHouseScene(original.site, original.spatial)!.houses[0];
  const moved = updateStudioHouse(original, {
    ...house,
    position: { xMm: "123", yMm: "456", rotationDeg: "37" },
  });
  const canonical = websiteComposition(moved)[0];
  const solve = vi.spyOn(houseGeometry, "solveStudioHouse"),
    product = vi.spyOn(physical, "websiteProductPhysical");
  try {
    const next = resolver.resolve(moved);
    expect(next.products[0].geometry).toBe(first.products[0].geometry);
    expect(next.products[0].physical).toBe(first.products[0].physical);
    expect(solve).not.toHaveBeenCalled();
    expect(product).not.toHaveBeenCalled();
    expect(next.rows[0].position!.x).toBeCloseTo(canonical.position!.x, 7);
    expect(next.rows[0].position!.y).toBeCloseTo(canonical.position!.y, 7);
    const point = { x: 500, y: 700 };
    expect(transformWebsitePoint(point, next.rows[0].position!)).toEqual(
      expect.objectContaining({
        x: expect.closeTo(
          transformWebsitePoint(point, canonical.position!).x,
          7,
        ),
        y: expect.closeTo(
          transformWebsitePoint(point, canonical.position!).y,
          7,
        ),
      }),
    );
    expect(next.free.get("p")!.error).toBeNull();
    expect(resolver.resolve(structuredClone(moved))).toBe(next);
  } finally {
    solve.mockRestore();
    product.mockRestore();
  }
});

it("never hides newly invalid pose/input behind a cached valid row or free capability", () => {
  const edit = fixture(),
    resolver = createStudioSceneResolver();
  resolver.resolve(edit);
  const badPose = structuredClone(edit);
  badPose.spatial.pergolas[0].position!.originXMm = "bad";
  const invalidPose = resolver.resolve(badPose);
  expect(invalidPose.rows[0].error).toContain("valid position");
  expect(invalidPose.free.get("p")!.error).toContain("valid position");
  const recovered = resolver.resolve(
    positionWebsitePergola(edit, "p", { originXMm: "123" }),
  );
  expect(recovered.rows[0].error).toBeNull();
  expect(recovered.rows[0].position!.x).toBe(123);
  const bad = structuredClone(edit);
  (bad.objectOptions[0].values.websiteDesign as any).rawDimensions = {
    widthMm: "bad",
    projectionMm: "3000",
  };
  const invalid = resolver.resolve(bad);
  expect(invalid.rows[0].error).toContain("positive whole millimetre");
  expect(invalid.free.get("p")!.error).toContain("positive whole millimetre");
  expect(resolver.resolve(edit).rows[0].error).toBeNull();
});

it("refreshes retained reference display and support without blessing invalid current attachment", () => {
  const edit = fixture(true),
    resolver = createStudioSceneResolver();
  resolver.resolve(edit);
  const invalid = structuredClone(edit);
  (invalid.objectOptions[0].values.websiteDesign as any).rawDimensions = {
    widthMm: "bad",
    projectionMm: "3000",
  };
  const before = resolver.resolve(invalid),
    changed = structuredClone(invalid),
    binding = (changed.site.websiteAttachments as any).attachments[0];
  binding.reference = {
    position: { x: 123, y: 456, rotation: 37 },
    supportDatumMm: 3500,
  };
  const next = resolver.resolve(changed);
  expect(next.products[0].referenceDisplay).toBe(true);
  expect(next.products[0].position).toEqual(binding.reference.position);
  expect(next.products[0].geometryOptions).toEqual({ supportDatumMm: 3500 });
  expect(next.products[0].geometry).not.toBe(before.products[0].geometry);
  expect(next.rows[0].error).toBeTruthy();
  expect(next.free.get("p")!.error).toBeTruthy();
  expect(next.rows[0].reference).toEqual(binding.reference);
});

it("keys actual support and accessory choices and preserves canonical geometry outputs", () => {
  const edit = fixture(),
    resolver = createStudioSceneResolver(),
    first = resolver.resolve(edit),
    value = websiteComposition(edit)[0].value!;
  const changed = changeStudioProduct(edit, {
    ...value,
    supportDatumMm: "3100",
    selection: {
      ...value.selection,
      roof: {
        ...value.selection.roof,
        lighting: { ...DEFAULT_LIGHTING, rafterCount: 3 },
      },
    },
  });
  const next = resolver.resolve(changed),
    row = websiteComposition(changed)[0];
  expect(next.products[0].geometry).not.toBe(first.products[0].geometry);
  expect(next.products[0].geometry).toEqual(
    solvePergolaPreview(
      row.design!.input,
      row.design!.roof,
      row.geometryOptions,
    ).geometry,
  );
  expect(next.rows[0].value).toEqual(row.value);
  expect(next.rows[0].geometryOptions).toEqual(row.geometryOptions);
});

it.each(["cold", "warm"] as const)(
  "preserves host-only canonical authority through %s pose/shape/support/method and reload",
  (mode) => {
    let edit = fixture(true);
    delete edit.site.websiteAttachments;
    const warm = createStudioSceneResolver();
    if (mode === "warm") warm.resolve(edit);
    const check = (current: StudioAuthoringEdit) => {
      const parsed = parseStudioAuthoringEdit(
        JSON.parse(JSON.stringify(current)),
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw Error(parsed.message);
      const expected = websiteComposition(parsed.value)[0],
        actual = (mode === "warm" ? warm : createStudioSceneResolver()).resolve(
          parsed.value,
        ),
        row = actual.rows[0];
      expect(row.error).toBe(expected.error);
      expect(row.geometryOptions).toEqual(expected.geometryOptions);
      if (expected.attachment?.target) {
        for (const endpoint of ["start", "end", "centre"] as const) {
          for (const axis of ["x", "y", "z"] as const) {
            const actualPoint = row.attachment!.target![endpoint] as Record<
                string,
                number
              >,
              expectedPoint = expected.attachment.target[endpoint] as Record<
                string,
                number
              >;
            if (expectedPoint[axis] === undefined)
              expect(actualPoint[axis]).toBeUndefined();
            else expect(actualPoint[axis]).toBeCloseTo(expectedPoint[axis], 7);
          }
        }
      }
      if (expected.position) {
        expect(Object.keys(row.position!)).toEqual(
          Object.keys(expected.position),
        );
        expect(row.position!.x).toBeCloseTo(expected.position.x, 7);
        expect(row.position!.y).toBeCloseTo(expected.position.y, 7);
        expect(row.position!.rotation).toBeCloseTo(
          expected.position.rotation,
          7,
        );
      } else expect(row.position).toBe(expected.position);
      expect(actual.scene.attachments).toHaveLength(0);
      expect(row.object.attachment!.host).toEqual(
        expected.object.attachment!.host,
      );
      if (!expected.error) {
        const detached = websiteComposition(
          detachWebsitePergola(parsed.value, "p"),
        )[0];
        expect(actual.free.get("p")!.error).toBe(detached.error);
        expect(actual.free.get("p")!.row.value).toEqual(detached.value);
        expect(actual.free.get("p")!.row.geometryOptions).toEqual(
          detached.geometryOptions,
        );
      } else expect(actual.free.get("p")!.error).toBe(expected.error);
    };
    check(edit);
    for (const patch of [
      { position: { xMm: "1000", yMm: "2000", rotationDeg: "0" } },
      { position: { xMm: "1000", yMm: "2000", rotationDeg: "280" } },
      { widthMm: "9000", wallHeightMm: "3500", eaveHeightMm: "3500" },
    ]) {
      const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
      edit = updateStudioHouse(edit, { ...house, ...patch });
      check(edit);
    }
    const roofEdge = websiteHouseTargets(edit.spatial).find(
      (target) => target.edgeKind === "roof_eave" && !target.error,
    )!;
    edit = attachWebsitePergola(
      edit,
      "p",
      roofEdge.id,
      "house",
      "fascia_under_gutter",
    );
    check(edit);
    const mismatch = structuredClone(edit);
    (
      mismatch.objectOptions[0].values.websiteDesign as any
    ).selection.input.connection = "soffit";
    check(mismatch);
    check(edit);
  },
);

it.each(["cold", "warm"] as const)(
  "isolates a retained invalid house in a %s scene, preserves attached refusal/reference and valid free peer, then recovers",
  (mode) => {
    const edit = addWebsitePergola(fixture(true), "peer"),
      resolver = createStudioSceneResolver();
    if (mode === "warm") resolver.resolve(edit);
    const invalid = structuredClone(edit);
    invalid.spatial.houseAssembly!.houseForms[0].wallHeightM = "bad";
    expect(parseStudioAuthoringEdit(invalid).ok).toBe(true);
    const canonical = websiteComposition(invalid),
      actual = resolver.resolve(invalid);
    expect(actual.houseRecords).toHaveLength(1);
    expect(actual.houseRecords[0].source.wallHeightM).toBe("bad");
    expect(actual.houseRecords[0].house!.wallHeightMm).toBe("bad");
    expect(actual.houseRecords[0].error).toBe(
      "Enter a valid wall height. Your input is kept.",
    );
    expect(actual.houseRecords[0].geometry).toBeNull();
    expect(actual.houses).toHaveLength(0);
    for (const row of actual.rows) {
      const expected = canonical.find(
        (item) => item.object.id === row.object.id,
      )!;
      expect(row.error).toBe(expected.error);
      expect(row.geometryOptions).toEqual(expected.geometryOptions);
      expect(row.position).toEqual(expected.position);
    }
    expect(
      actual.products.find((row) => row.object.id === "p")!.referenceDisplay,
    ).toBe(true);
    expect(actual.rows[0].reference).toEqual(canonical[0].reference);
    expect(actual.free.get("p")!.error).toBe(canonical[0].error);
    expect(
      actual.products.find((row) => row.object.id === "peer")!.geometry,
    ).toBeTruthy();
    expect(actual.free.get("peer")!.error).toBeNull();
    const restored = resolver.resolve(edit);
    expect(restored.houseRecords[0].error).toBeNull();
    expect(restored.houses).toHaveLength(1);
    expect(restored.rows.every((row) => !row.error)).toBe(true);
  },
);

it("owns readonly structural snapshots without aliasing mutable authored input", () => {
  const edit = fixture(),
    scene = createStudioSceneResolver().resolve(edit);
  edit.spatial.houseAssembly!.houseForms[0].wallHeightM = "bad";
  edit.spatial.pergolas[0].label = "Changed outside scene";
  expect(scene.houseRecords[0].source.wallHeightM).toBe("3.2");
  expect(scene.rows[0].object.label).toBe("Pergola 1");
  expect(Object.isFrozen(scene)).toBe(true);
  expect(Object.isFrozen(scene.rows)).toBe(true);
  expect(Object.isFrozen(scene.products[0])).toBe(true);
  expect(Object.isFrozen(scene.scene.houses)).toBe(true);
});
