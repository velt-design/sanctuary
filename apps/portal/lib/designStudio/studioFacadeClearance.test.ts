import { nudgeStudioSceneObject } from "./studioSceneCommands";
import { expect, it } from "vitest";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { studioHouseScene } from "./studioHouseScene";
import {
  changeStudioProduct,
  previewStudioAttachment,
  updateStudioHouse,
} from "./studioHouseCommands";
import { websiteComposition } from "./websiteComposition";
import { parseStudioAuthoringEdit } from "./authoringView";
import { studioDisplayProduct } from "./studioDisplayProduct";
import { readStudioFacadeClearance } from "./studioFacadeClearance";
function measure(row: ReturnType<typeof websiteComposition>[number]) {
  return row.attachment && "measurements" in row.attachment
    ? row.attachment.measurements
    : null;
}
function fixture(
  gap?: string,
  eave = "4000",
  family: "mono" | "gable" | "box" = "mono",
  rotation = 37,
) {
  let edit = studioAttachmentFixture(rotation, "hipped"),
    house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    eaveHeightMm: eave,
    wallHeightMm: eave,
    roof: { ...house.roof, pitchDeg: "15" },
  });
  const value = websiteComposition(edit)[0].value!;
  edit = changeStudioProduct(edit, {
    ...value,
    ...(gap !== undefined ? { facadeClearanceMm: gap } : {}),
    rawDimensions: { widthMm: "6000", projectionMm: "4000" },
    selection: {
      ...value.selection,
      roof: { ...value.selection.roof, family },
    },
  });
  return edit;
}
it.each(["200", "300", "700"])(
  "fits physical roof clearance %s at a rotated actual house without changing that house",
  (gap) => {
    const edit = fixture(gap),
      house = structuredClone(edit.spatial.houseAssembly);
    const connected = previewStudioAttachment(edit, {
        objectId: "p2",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
      }),
      row = websiteComposition(connected)[0];
    expect(row.error).toBeNull();
    expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(
      Number(gap) - 0.0001,
    );
    expect(measure(row)?.roofClearanceMm).toBeLessThan(Number(gap) + 1.01);
    expect(connected.spatial.houseAssembly).toEqual(house);
    expect(row.value?.facadeClearanceMm).toBe(gap);
    const reload = parseStudioAuthoringEdit(
      JSON.parse(JSON.stringify(connected)),
    );
    expect(reload.ok).toBe(true);
    if (reload.ok)
      expect(websiteComposition(reload.value)[0].geometryOptions).toEqual(
        row.geometryOptions,
      );
  },
);
it.each(["gable", "box"] as const)(
  "uses the actual %s roof at its connection rather than a distant roof apex",
  (family) => {
    const connected = previewStudioAttachment(fixture("200", "4000", family), {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
    });
    const row = websiteComposition(connected)[0];
    expect(row.error).toBeNull();
    expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(199.9999);
    expect(measure(row)?.roofClearanceMm).toBeLessThan(201.01);
  },
);
it("retains the existing legacy solve when the setting is absent", () => {
  const connected = previewStudioAttachment(fixture(), {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
    }),
    row = websiteComposition(connected)[0];
  expect(row.value?.facadeClearanceMm).toBeUndefined();
  expect(row.geometryOptions?.supportDatumMm).toBe(3189);
  expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(5);
  expect(measure(row)?.roofClearanceMm).toBeLessThan(6.01);
});
it.each(["", "199", "NaN"])(
  "retains invalid raw %j and the last connected reference without clamping",
  (raw) => {
    const connected = previewStudioAttachment(fixture("300"), {
        objectId: "p2",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
      }),
      before = websiteComposition(connected)[0];
    const invalid = changeStudioProduct(connected, {
        ...before.value!,
        facadeClearanceMm: raw,
      }),
      row = websiteComposition(invalid)[0];
    expect(row.value?.facadeClearanceMm).toBe(raw);
    expect(row.error).toContain("200 mm");
    expect(row.reference).toEqual(before.reference);
    expect(studioDisplayProduct(row).geometryOptions?.supportDatumMm).toBe(
      before.geometryOptions?.supportDatumMm,
    );
  },
);
it("refuses an actually too-low house instead of changing measured dimensions or the support minimum", () => {
  const edit = fixture("200", "2700"),
    original = JSON.stringify(edit.spatial.houseAssembly);
  expect(() =>
    previewStudioAttachment(edit, {
      objectId: "p2",
      houseId: "house",
      edge: "rear",
      kind: "wall",
      method: "facade",
    }),
  ).toThrow(/2000–5000/);
  expect(JSON.stringify(edit.spatial.houseAssembly)).toBe(original);
  expect(readStudioFacadeClearance("700")).toBe(700);
});

it.each(["front", "rear", "left", "right"] as const)(
  "measures the actual local underside on %s at 37 degrees, including a zero-overhang section",
  (edge) => {
    let edit = fixture("300"),
      house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
    edit = updateStudioHouse(edit, {
      ...house,
      roof: { ...house.roof, overhangMm: "0" },
    });
    const connected = previewStudioAttachment(edit, {
        objectId: "p2",
        houseId: "house",
        edge,
        kind: "wall",
        method: "facade",
      }),
      row = websiteComposition(connected)[0];
    expect(row.error).toBeNull();
    expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(300);
    expect(measure(row)?.roofClearanceMm).toBeLessThan(301.01);
  },
);

it("adopts a verified host-only relationship only on explicit clearance, preserving XY and actual house and fitting the requested roof gap", () => {
  let historical = previewStudioAttachment(fixture(), {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
  });
  delete historical.site.websiteAttachments;
  const untouched = structuredClone(historical),
    before = websiteComposition(historical)[0];
  expect(before.error).toBeNull();
  expect(before.studioAttachment).toBeNull();
  expect(before.value?.facadeClearanceMm).toBeUndefined();
  expect(historical).toEqual(untouched);
  let changed = changeStudioProduct(historical, {
      ...before.value!,
      facadeClearanceMm: "700",
    }),
    row = websiteComposition(changed)[0];
  expect(row.error).toBeNull();
  expect(row.studioAttachment?.edge).toBe("rear");
  expect(row.value?.facadeClearanceMm).toBe("700");
  expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(700);
  expect(row.position).toEqual(before.position);
  expect(changed.spatial.houseAssembly).toEqual(
    historical.spatial.houseAssembly,
  );
  expect(row.geometryOptions?.supportDatumMm).toBeLessThan(
    before.geometryOptions!.supportDatumMm!,
  );
  changed = nudgeStudioSceneObject(changed, "p2", 10, 10).edit;
  row = websiteComposition(changed)[0];
  expect(row.value?.facadeClearanceMm).toBe("700");
  expect(measure(row)?.roofClearanceMm).toBeGreaterThanOrEqual(700);
  const reload = parseStudioAuthoringEdit(JSON.parse(JSON.stringify(changed)));
  expect(reload.ok).toBe(true);
  if (reload.ok)
    expect(websiteComposition(reload.value)[0].geometryOptions).toEqual(
      row.geometryOptions,
    );
});
it("withholds an explicit gap on a saved host-only source until its real edge is chosen, while displaying its retained actual shape", () => {
  const historical = previewStudioAttachment(fixture(), {
    objectId: "p2",
    houseId: "house",
    edge: "rear",
    kind: "wall",
    method: "facade",
  });
  delete historical.site.websiteAttachments;
  const before = websiteComposition(historical)[0],
    saved = structuredClone(historical);
  (
    saved.objectOptions[0].values.websiteDesign as unknown as {
      facadeClearanceMm: string;
    }
  ).facadeClearanceMm = "700";
  const row = websiteComposition(saved)[0];
  expect(row.error).toContain("Choose the actual house edge");
  expect(row.studioAttachment).toBeNull();
  expect(row.geometryOptions).toEqual(before.geometryOptions);
  expect(row.position).toEqual(before.position);
  expect(studioDisplayProduct(row).geometryOptions).toEqual(
    before.geometryOptions,
  );
});
