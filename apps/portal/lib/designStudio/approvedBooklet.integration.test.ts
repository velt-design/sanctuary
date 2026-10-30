// @vitest-environment node
import { it, expect, vi } from "vitest";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import {
  approvedDrawingSource,
  approvedAcrylicBattensSource,
  approvedCoverSource,
} from "../../../../test/fixtures/studio-approved-drawings";
import {
  parseStudioClientDocumentSource,
  studioDocumentPages,
} from "@sp/studio-documents/contract";
import {
  packStudioDrawing,
  unpackStudioDrawing,
} from "@sp/studio-documents/transport";
import {
  renderStudioDocumentPage,
  assembleStudioDocumentPages,
} from "@sp/studio-documents/render";
import { PDFDocument, PDFPage } from "pdf-lib";
import { approvedStudioDocumentPages } from "@sp/studio-documents/contract";
import { previewStudioAttachment } from "./studioHouseCommands";
import { projectStudioClientDocument } from "./clientDocumentProjection.server";
import { approvedDrawingEdit } from "../../../../test/fixtures/studio-approved-drawings";
import { studioClientDocumentFixture } from "../../../../test/fixtures/studio-client-documents";
import type { StudioWebsiteDesign } from "./websiteDesign";
import { relevantHouseContext } from "../../../../packages/studio-documents/src/approvedContext";
import {
  actualParts,
  drawGeometry,
} from "../../../../packages/studio-documents/src/approvedGeometry";
import {
  approvedLeaderRoute,
  LEADER_LENGTH_PT,
} from "../../../../packages/studio-documents/src/approvedAnnotations";
import { previewWebsiteJoin } from "./websiteJoins";
import {
  elevationView,
  blindElevationViews,
  approvedBlindCoverLabel,
} from "../../../../packages/studio-documents/src/approvedSheets";
import { websiteComposition } from "./websiteComposition";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import { representativeBlindOpenings } from "@sp/geometry";
import { defaultBlind } from "@sp/configurator/website";
import { createStudioSceneResolver } from "./interaction/resolvedScene";
import {
  approvedRoofSurfaces,
  approvedGlazingBoundaries,
  approvedAcrylicPlanTarget,
} from "../../../../packages/studio-documents/src/approvedRoofSurfaces";
import { approvedDrawingNote } from "../../../../packages/studio-documents/src/approvedRender";
import { fonts as documentFonts, headingInkBounds } from "../../../../packages/studio-documents/src/assets";
import { approvedSpecificationLayout } from "../../../../packages/studio-documents/src/approvedLayout";
import { approvedPlanMaterialTarget, approvedPitchFootprints, segmentCrossesBounds } from "../../../../packages/studio-documents/src/approvedPlanMaterialTarget";
import { refinedSpecificationRows } from "../../../../packages/studio-documents/src/refinedFacts";
import { approvedBlindLabel, blindLabelIntersects } from "../../../../packages/studio-documents/src/approvedBlindLabels";

it.each([
  null,
  "",
  true,
  1,
  {},
  [],
  "legacy",
  "studio-booklet-layout.v1",
  "studio-booklet-layout.v5",
])("refuses an explicitly unsupported frozen selector %j", (selector) => {
  const source = approvedDrawingSource();
  expect(() =>
    parseStudioClientDocumentSource({ ...source, layoutVersion: selector }),
  ).toThrow();
});
it("accepts absence only as legacy and the explicit previous selector only without a v3 inventory", () => {
  const source = approvedDrawingSource();
  const { layoutVersion: _, pageManifest: __, ...legacy } = source;
  expect(parseStudioClientDocumentSource(legacy)).not.toHaveProperty(
    "layoutVersion",
  );
  expect(
    parseStudioClientDocumentSource({
      ...legacy,
      layoutVersion: "studio-booklet-layout.v2",
    }).layoutVersion,
  ).toBe("studio-booklet-layout.v2");
});

it("freezes selected canonical lighting and job-specific sheets, including the genuine Box inset and retained LEDs", async () => {
  const source = approvedDrawingSource(),
    box = source.products[2];
  expect(box.drawingDetails!.lights.rafters).toHaveLength(8);
  expect([
    ...new Set(box.drawingDetails!.lights.rafters.map((s) => s.point.x)),
  ]).toEqual([1245, 2415, 3585, 4755]);
  expect(
    box
      .drawingDetails!.lights.strips.filter((s) => s.rafter)
      .map((s) => s.start.x),
  ).toEqual([660, 5340]);
  expect(
    studioDocumentPages(source)
      .filter((s) => s.objectId === box.id)
      .map((s) => s.kind),
  ).toEqual(["plan", "iso", "elevation", "lighting"]);
  expect(
    source.products[0].drawingDetails!.blinds.map((b) => b.lowered),
  ).toEqual([100, 60, 100]);
  expect(
    source.products[0].drawingDetails!.blinds.map((b) => b.opening.width),
  ).toEqual([2775, 2775, 3715]);
  expect(parseStudioClientDocumentSource(source)).toEqual(source);
  const packed = await packStudioDrawing(source);
  expect(packed).toHaveProperty("pageManifest", source.pageManifest);
  expect(await unpackStudioDrawing(packed)).toEqual(source);
  const invalid = structuredClone(source);
  invalid.pageManifest!.pop();
  expect(() => parseStudioClientDocumentSource(invalid)).toThrow("inventory");
});
it("projects true gutter caps and edge-on ridge thickness without upsizing the original members", () => {
  const source = approvedDrawingSource(),
    pitched = source.products[0],
    parts = actualParts(pitched, { physicalDetails: true });
  const caps = parts.filter((p) => p.id.includes(":cap:"));
  expect(caps.length).toBeGreaterThanOrEqual(2);
  for (const cap of caps) {
    const points = cap.triangles.flat(),
      range = (key: "x" | "y" | "z") =>
        Math.max(...points.map((p) => p[key])) -
        Math.min(...points.map((p) => p[key]));
    expect(range("x")).toBeCloseTo(3, 5);
    expect(range("y")).toBeCloseTo(100, 5);
    expect(range("z")).toBeCloseTo(150, 5);
  }
  expect(
    pitched.assembly.members.find((m) => m.id === "house-beam")!.profile
      .depthMm,
  ).toBe(150);
  expect(
    pitched.assembly.members.find((m) => m.id === "finish-rafter-0-0")!.profile
      .depthMm,
  ).toBe(150);
  const flashing = actualParts(source.products[1], {
    physicalDetails: true,
  }).filter((p) => p.kind === "flashing");
  expect(
    flashing.some((p) =>
      p.triangles.some(
        ([a, b, c]) =>
          Math.abs((b.y - a.y) * (c.z - a.z) - (c.y - a.y) * (b.z - a.z)) > 1,
      ),
    ),
  ).toBe(true);
});
it("keeps solid roof opaque from above and actual cedar visible from below with unchanged XY coordinates", async () => {
  const product = approvedDrawingSource().products[0],
    mesh = product.covering!.meshes.find((m) => m.kind === "cedar")!;
  const point = Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
    mesh.indices
      .slice(i * 3, i * 3 + 3)
      .map((n) => ({
        x: mesh.positions[n * 3],
        y: mesh.positions[n * 3 + 1],
        z: mesh.positions[n * 3 + 2],
      }))
      .reduce(
        (a, p) => ({ x: a.x + p.x / 3, y: a.y + p.y / 3, z: a.z + p.z / 3 }),
        { x: 0, y: 0, z: 0 },
      ),
  ).find((p) => p.x > 400 && p.x < 1800 && p.y > 1000 && p.y < 3000)!;
  expect(point).toBeDefined();
  for (const view of ["plan", "rcp"] as const) {
    const pdf = await PDFDocument.create(),
      page = pdf.addPage();
    let raster = Buffer.alloc(0);
    let imageBounds = { x: 0, y: 0, width: 1, height: 1 };
    const embed = pdf.embedPng.bind(pdf);
    vi.spyOn(pdf, "embedPng").mockImplementation(async (bytes) => {
      raster = Buffer.from(bytes as Uint8Array);
      return embed(bytes);
    });
    const draw = page.drawImage.bind(page);
    vi.spyOn(page, "drawImage").mockImplementation((image, options) => {
      imageBounds = {
        x: options!.x!,
        y: options!.y!,
        width: options!.width!,
        height: options!.height!,
      };
      return draw(image, options);
    });
    const geometry = await drawGeometry(pdf, page, product, {
      view,
      viewport: { x: 450, y: 200, w: 480, h: 400 },
      scale: 72 / 25.4 / 40,
    });
    const width = raster.readUInt32BE(16),
      height = raster.readUInt32BE(20),
      chunks: Buffer[] = [];
    for (let offset = 8; offset < raster.length; ) {
      const length = raster.readUInt32BE(offset),
        name = raster.toString("ascii", offset + 4, offset + 8);
      if (name === "IDAT")
        chunks.push(raster.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks)),
      q = geometry.map(point),
      x = Math.floor(((q.x - imageBounds.x) / imageBounds.width) * width),
      top = 841.89 - imageBounds.y - imageBounds.height,
      y = Math.floor(((q.y - top) / imageBounds.height) * height),
      at = y * (width * 3 + 1) + 1 + x * 3,
      pixel = [...raw.subarray(at, at + 3)];
    if (view === "plan") expect(pixel[0]).toBe(pixel[1]);
    else {
      expect(pixel[0]).toBeGreaterThan(pixel[1] + 3);
      expect(pixel[1]).toBeGreaterThan(pixel[2] + 4);
    }
    expect(geometry.map({ x: 123, y: 456, z: 100 })).toMatchObject({
      x: geometry.map({ x: 123, y: 456, z: 999 }).x,
      y: geometry.map({ x: 123, y: 456, z: 999 }).y,
    });
  }
}, 15000);
it.each(["left", "right"] as const)(
  "keeps equal19mm mirrored30-degree annotation shafts and actual-heading ink gaps on the %s",
  (side) => {
    const ink = { left: 0.6, right: 45.2 },
      x = side === "left" ? 280 : 1014,
      anchor = { x: side === "left" ? 620 : 850, y: 400 };
    const route = approvedLeaderRoute(anchor, side, -1, x, ink);
    expect(
      Math.hypot(route.elbow.x - anchor.x, route.elbow.y - anchor.y),
    ).toBeCloseTo(LEADER_LENGTH_PT, 10);
    expect(
      Math.abs(
        (Math.atan2(
          route.elbow.y - anchor.y,
          Math.abs(route.elbow.x - anchor.x),
        ) *
          180) /
          Math.PI,
      ),
    ).toBeCloseTo(30, 10);
    expect(
      Math.abs(route.tail.x - (x + (side === "left" ? ink.right : ink.left))),
    ).toBeCloseTo(2.5, 10);
  },
);
it("renders the actual v3 page path from canonical mixed/gable/Box selections, never from sample PDF splicing", async () => {
  const source = approvedDrawingSource(),
    sheets = studioDocumentPages(source),
    pages: Uint8Array[] = [];
  for (const sheet of sheets) {
    const page = await renderStudioDocumentPage(source, sheet.index);
    expect((await PDFDocument.load(page)).getPageCount()).toBe(1);
    pages.push(page);
  }
  const pdf = await assembleStudioDocumentPages(pages);
  expect((await PDFDocument.load(pdf)).getPageCount()).toBe(sheets.length);
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR) {
    await mkdir(process.env.STUDIO_APPROVED_OUTPUT_DIR, { recursive: true });
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Integrated-Booklet.pdf`,
      pdf,
    );
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/source.private.json`,
      JSON.stringify(source),
    );
  }
}, 120000);
it("keeps actual rotated attachment context at the primary drawing scale instead of fitting the full house", async () => {
  const edit = studioClientDocumentFixture();
  edit.spatial.pergolas = edit.spatial.pergolas.filter((p) => p.id === "p1");
  edit.objectOptions = edit.objectOptions.filter((o) => o.objectId === "p1");
  const design = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  design.rawDimensions.widthMm = "3000";
  const house = edit.spatial.houseAssembly!.houseForms[0];
  house.position = {
    ...(house.position ?? { originXMm: "0", originYMm: "-5000" }),
    rotationDeg: "37",
  };
  house.wallHeightM = "3.6";
  house.eaveHeightM = "3.8";
  const primitive = house.composition.primitives[0];
  if (primitive.kind !== "axisAlignedRectangle")
    throw Error("Synthetic rectangular house unavailable");
  primitive.widthMm = 9000;
  primitive.depthMm = 9000;
  const attached = previewStudioAttachment(edit, {
    objectId: "p1",
    houseId: house.id,
    edge: "front",
    kind: "wall",
    method: "facade",
    contactBasis: "canonical-house.v1",
  });
  const source = projectStudioClientDocument(attached, {
    layoutVersion: "studio-booklet-layout.v3",
    designVersionLabel: "V1",
    snapshotId: "10000000-0000-4000-8000-000000000009",
    contentHash: "b".repeat(64),
    projectName: "Synthetic rotated attachment",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
  expect(
    Math.abs(
      Math.sin(((source.products[0].pose.rotation - 37) * Math.PI) / 180),
    ),
  ).toBeLessThan(1e-6);
  expect(
    relevantHouseContext(source, source.products[0]).length,
  ).toBeGreaterThan(0);
  const bytes = await renderStudioDocumentPage(source, 1);
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR)
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Attached-Plan.pdf`,
      bytes,
    );
}, 30000);
it("retains all32 products and the complete193-entry v3 register without rendering193 raster sheets", async () => {
  const source = approvedDrawingSource(),
    base = source.products[0];
  source.projectName = "CapacityProject" + "W".repeat(265);
  source.products = Array.from({ length: 32 }, (_, index) => ({
    ...structuredClone(base),
    id: `p${index + 1}`,
    code: `P${String(index + 1).padStart(2, "0")}`,
    label: `P${index + 1}` + "W".repeat(200 - `P${index + 1}`.length),
  }));
  source.pageManifest = approvedStudioDocumentPages(source);
  expect(
    studioDocumentPages(parseStudioClientDocumentSource(source)),
  ).toHaveLength(193);
  const cover = await renderStudioDocumentPage(source, 0);
  expect((await PDFDocument.load(cover)).getPageCount()).toBe(1);
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR)
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Capacity-Register.pdf`,
      cover,
    );
}, 30000);
it("retains true canonical joined geometry before isolating a v3 pergola view", () => {
  const edit = studioClientDocumentFixture();
  edit.objectOptions[1].values.websiteDesign = {
    ...(structuredClone(edit.objectOptions[0].values.websiteDesign) as object),
    objectId: "p2",
  };
  edit.spatial.pergolas[1].family = edit.spatial.pergolas[0].family;
  const joined = previewWebsiteJoin(edit, {
    id: "join",
    a: { objectId: "p2", edge: "left" },
    b: { objectId: "p1", edge: "right" },
    alignment: "centre",
  }).edit;
  const source = projectStudioClientDocument(joined, {
    layoutVersion: "studio-booklet-layout.v3",
    snapshotId: "10000000-0000-4000-8000-000000000008",
    contentHash: "c".repeat(64),
    designVersionLabel: "V1",
    projectName: "Synthetic joined projection",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
  for (const product of source.products) {
    expect(
      actualParts(product, { joins: source.joins }).find(
        (p) => p.id === "selected-pergola-joins",
      )!.triangles.length,
    ).toBeGreaterThan(0);
    expect(
      actualParts(product, {
        roof: false,
        frame: false,
        joins: source.joins,
      }).some((p) => p.id === "selected-pergola-joins"),
    ).toBe(false);
  }
});
it("retains the solid Box two-fall topology and its appropriate conditional pages", async () => {
  const source = approvedDrawingSource("solid"),
    product = source.products[2];
  expect(product.assembly.roofPlanes).toHaveLength(2);
  const a = product.assembly.roofPlanes[0].fallVector,
    b = product.assembly.roofPlanes[1].fallVector;
  expect(a.x * b.x + a.y * b.y).toBeLessThan(0);
  const plan = studioDocumentPages(source).find(
    (s) => s.objectId === product.id && s.kind === "plan",
  )!;
  const bytes = await renderStudioDocumentPage(source, plan.index);
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR)
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Solid-Box-Plan.pdf`,
      bytes,
    );
}, 15000);
it("chooses the actual gable end from the ridge axis for the alternate roof orientation", async () => {
  const edit = approvedDrawingEdit(),
    design = edit.objectOptions[1].values
      .websiteDesign as unknown as StudioWebsiteDesign;
  design.selection.roof.orientation = "away";
  design.selection.input.connection = "fascia";
  edit.spatial.pergolas = edit.spatial.pergolas.filter((p) => p.id === "p2");
  edit.objectOptions = edit.objectOptions.filter((o) => o.objectId === "p2");
  const resolved = createStudioSceneResolver().resolve(edit);
  if (resolved.arrangementEligibility || resolved.products.some((p) => p.error))
    throw Error(
      JSON.stringify({
        arrangement: resolved.arrangementEligibility,
        products: resolved.products.map((p) => ({
          id: p.object.id,
          error: p.error,
        })),
      }),
    );
  const source = projectStudioClientDocument(edit, {
    layoutVersion: "studio-booklet-layout.v3",
    snapshotId: "10000000-0000-4000-8000-000000000007",
    contentHash: "d".repeat(64),
    designVersionLabel: "V1",
    projectName: "Synthetic alternate gable",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
  expect(elevationView(source.products[0])).toBe("front");
  const sheet = source.pageManifest!.find(
    (s) => s.objectId === "p2" && s.kind === "elevation",
  )!;
  const bytes = await renderStudioDocumentPage(source, sheet.index);
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR)
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Alternate-Gable-Elevation.pdf`,
      bytes,
    );
}, 15000);
it("keeps front/left/right/rear blind projections distinct instead of silently mirroring rear or right selections", async () => {
  const edit = approvedDrawingEdit(),
    row = websiteComposition(edit)[0];
  if (!row.design) throw Error("Synthetic design unavailable");
  const geometry = solvePergolaPreview(
    row.design.input,
    row.design.roof,
    row.geometryOptions,
  ).geometry!;
  const design = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  design.selection.roof.blinds = representativeBlindOpenings(
    geometry.assembly,
    { rearOpenings: true },
  ).map((opening, index) => ({
    ...defaultBlind(opening.id),
    cover: "PELMET",
    lowered: index % 2 ? 60 : 100,
  }));
  const source = projectStudioClientDocument(edit, {
    layoutVersion: "studio-booklet-layout.v3",
    snapshotId: "10000000-0000-4000-8000-000000000005",
    contentHash: "e".repeat(64),
    designVersionLabel: "V1",
    projectName: "Synthetic four-side blinds",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
  expect(
    blindElevationViews(source.products[0]).map((v) => v.slice(0, 2)),
  ).toEqual([
    ["front", "front"],
    ["left", "side"],
    ["right", "right"],
    ["rear", "rear"],
  ]);
  const sheet = source.pageManifest!.find(
    (s) => s.objectId === "p1" && s.kind === "blind-elevation",
  )!;
  const drawn = vi.spyOn(PDFPage.prototype, "drawText");
  let bytes: Uint8Array = new Uint8Array();
  try {
    for (const entry of [source.pageManifest!.find(s => s.objectId === 'p1' && s.kind === 'blind-plan')!,sheet]) {
      drawn.mockClear();
      bytes = await renderStudioDocumentPage(source, entry.index);
      const values = drawn.mock.calls.map(([value]) => value);
      for (const [index, blind] of source.products[0].drawingDetails!.blinds.entries())
        expect(values).not.toContain(`B${index + 1} / ${blind.description} / ${blind.lowered}% lowered`);
      expect(values.filter(value => entry.kind === 'blind-elevation' ? /^B\d+ \/ \d+%/.test(value) : /^B\d+$/.test(value))).toHaveLength(6);
    }
  } finally { drawn.mockRestore(); }
  if (process.env.STUDIO_APPROVED_OUTPUT_DIR)
    await writeFile(
      `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Four-Side-Blind-Elevations.pdf`,
      bytes,
    );
}, 15000);

it("keeps canonical mono acrylic glazing and actual open battens distinct from an opaque roof or ceiling", async () => {
  const source = approvedAcrylicBattensSource();
  const product = source.products[0];
  const plain = approvedAcrylicBattensSource(false).products[0];
  const surfaces = approvedRoofSurfaces(product);
  expect(surfaces).toMatchObject({
    hasOpaqueRoof: false,
    fullAcrylicRoof: true,
    hasOpenBattens: true,
    hasContinuousCeiling: false,
    solidRegions: [],
  });
  expect(product.assembly.family).toBe("mono");
  expect(product.assembly.roofCladdingPanels).toHaveLength(0);
  expect(product.covering!.meshes).toHaveLength(1);
  expect(product.covering!.meshes[0].id).toBe("roof-battens-0");
  expect(product.covering!.battenBoundaries!.length).toBeGreaterThan(1);
  expect(product.drawingDetails!.lights.rafters).toHaveLength(10);
  expect(product.drawingDetails!.lights.cedar).toHaveLength(0);
  expect(product.drawingDetails!.lights.rafters.map((site) => site.id)).toEqual(
    plain.drawingDetails!.lights.rafters.map((site) => site.id),
  );
  expect(product.drawingDetails!.lights.strips).toEqual(
    plain.drawingDetails!.lights.strips,
  );
  const frozenProduct = structuredClone(product);
  const target = approvedAcrylicPlanTarget(product);
  for (const rafter of product.assembly.members.filter(
    (member) => member.role === "rafter",
  ))
    expect(Math.abs(target.x - rafter.centerline.start.x)).toBeGreaterThan(
      rafter.profile.widthMm / 2,
    );
  for (const boundary of product.covering!.battenBoundaries!) {
    const minY = Math.min(...boundary.map((point) => point.y));
    const maxY = Math.max(...boundary.map((point) => point.y));
    expect(target.y < minY || target.y > maxY).toBe(true);
  }
  expect(target.x).toBeGreaterThan(0);
  expect(target.x).toBeLessThan(product.widthMm);
  expect(target.y).toBeGreaterThan(0);
  expect(target.y).toBeLessThan(product.projectionMm);
  const roof = product.assembly.roofPlanes[0].plane;
  expect(
    (target.x - roof.origin.x) * roof.normal.x +
      (target.y - roof.origin.y) * roof.normal.y +
      (target.z - roof.origin.z) * roof.normal.z,
  ).toBeCloseTo(0, 8);
  const parts = actualParts(product);
  expect(parts.filter((part) => part.glass)).toHaveLength(1);
  expect(
    parts.find((part) => part.id === "roof-battens-0")!.triangles,
  ).toHaveLength(product.covering!.meshes[0].indices.length / 3);
  expect(approvedGlazingBoundaries(product)).toEqual(
    approvedGlazingBoundaries(plain),
  );
  expect(approvedDrawingNote("plan", product)).toContain("Acrylic drawn clear");
  expect(approvedDrawingNote("lighting", product)).toContain(
    "spaced under-rafter timber battens",
  );
  expect(approvedDrawingNote("lighting", product)).not.toContain(
    "Actual ceiling",
  );

  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const lines = vi.spyOn(page, "drawLine");
  await drawGeometry(pdf, page, product, {
    view: "plan",
    viewport: { x: 450, y: 200, w: 480, h: 400 },
    scale: 72 / 25.4 / 40,
  });
  const glazingMarks = lines.mock.calls.filter(([options]) => {
    const colour = options?.color;
    return (
      colour?.type === "RGB" &&
      colour.red === 0.74 &&
      colour.green === 0.8 &&
      colour.blue === 0.8
    );
  });
  expect(glazingMarks).toHaveLength(
    approvedGlazingBoundaries(product).length * 4,
  );
  for (const kind of ["plan", "lighting"] as const) {
    const sheet = source.pageManifest!.find(
      (entry) => entry.objectId === product.id && entry.kind === kind,
    )!;
    const bytes = await renderStudioDocumentPage(source, sheet.index);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    if (process.env.STUDIO_APPROVED_OUTPUT_DIR) {
      await mkdir(process.env.STUDIO_APPROVED_OUTPUT_DIR, { recursive: true });
      await writeFile(
        `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Acrylic-Battens-${kind}.pdf`,
        bytes,
      );
    }
  }
  expect(product).toEqual(frozenProduct);
}, 15000);

it("retains explicit Box panes, mixed roof zones and real solid ceilings with the same semantic owner", () => {
  const mixed = approvedDrawingSource().products[0];
  const box = approvedDrawingSource().products[2];
  const solid = approvedDrawingSource("solid").products[2];
  expect(approvedGlazingBoundaries(box)).toHaveLength(10);
  expect(approvedRoofSurfaces(box)).toMatchObject({
    fullAcrylicRoof: true,
    hasOpaqueRoof: false,
    hasContinuousCeiling: false,
  });
  expect(approvedRoofSurfaces(mixed)).toMatchObject({
    fullAcrylicRoof: false,
    hasOpaqueRoof: true,
    hasContinuousCeiling: true,
  });
  expect(approvedGlazingBoundaries(mixed)).toHaveLength(
    mixed.assembly.roofCladdingPanels.length,
  );
  expect(approvedRoofSurfaces(solid)).toMatchObject({
    fullAcrylicRoof: false,
    hasOpaqueRoof: true,
    hasContinuousCeiling: true,
  });
  expect(approvedGlazingBoundaries(solid)).toHaveLength(0);
});

it('keeps the long frozen specification and approved column without the owner-deferred complete schedule', async () => {
  const source = approvedAcrylicBattensSource();
  const product = source.products[0];
  const pdf = await PDFDocument.create(), fonts = await documentFonts(pdf);
  const layout = approvedSpecificationLayout(product, fonts);
  expect(layout.rows.map(row => row.label)).toContain('GUTTER');
  const frozen = JSON.stringify(source);
  const drawn = vi.spyOn(PDFPage.prototype, 'drawText');
  try {
    const sheet = source.pageManifest!.find(s => s.kind === 'plan')!;
    const bytes = await renderStudioDocumentPage(source, sheet.index);
    const values = drawn.mock.calls.map(([value]) => value);
    for (const heading of ['SPECIFICATIONS','HEAD HEIGHTS','EXTRAS']) expect(values).toContain(heading);
    expect(values.some(value=>/complete schedule|schedule below/i.test(value))).toBe(false);
    expect(JSON.stringify(source)).toBe(frozen);
    if (process.env.STUDIO_APPROVED_OUTPUT_DIR) await writeFile(`${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Battens-Specification.pdf`, bytes);
  } finally { drawn.mockRestore(); }
}, 15000);

it('fits every combined acrylic/batten/four-face blind sheet in the restored full drawing field', async () => {
  const source = approvedAcrylicBattensSource(true, true);
  const product = source.products[0];
  expect(product.drawingDetails!.blinds).toHaveLength(6);
  expect(new Set(product.drawingDetails!.blinds.map(blind => blind.opening.side)).size).toBe(4);
  const sheets = source.pageManifest!.filter(sheet => sheet.objectId === product.id);
  expect(sheets.map(sheet => sheet.kind)).toEqual(['plan','iso','elevation','lighting','blind-plan','blind-elevation']);
  for (const sheet of sheets) expect((await renderStudioDocumentPage(source, sheet.index)).length).toBeGreaterThan(1000);
}, 15000);

it.each([0,5,40,60,100])('clears actual frozen fabric rails and font bounds for all selected faces at %s percent drop',async partialDrop=>{
  const source=approvedAcrylicBattensSource(true,true,partialDrop),product=source.products[0];
  const fonts=await documentFonts(await PDFDocument.create()),scale=72/25.4/100;
  for(const [index,blind] of product.drawingDetails!.blinds.entries()) {
    const side=blind.opening.side;
    const map=(p:{x:number;y:number;z:number})=>({x:850+(side==='front'?-p.x:side==='rear'?p.x:side==='left'?-p.y:p.y)*scale,y:400-p.z*scale});
    const placed=approvedBlindLabel(product,blind,index+1,map,fonts.medium);
    expect(placed.label).toContain(`B${index+1}`);
    expect(placed.hardware.every(rail=>!blindLabelIntersects(placed.ink,rail,2.5))).toBe(true);
    if(blind.lowered>=40) {
      expect(placed.placement).toBe('fabric');
      expect(placed.ink.top).toBeGreaterThanOrEqual(placed.fabric!.top+2.5);
      expect(placed.ink.bottom).toBeLessThanOrEqual(placed.fabric!.bottom-2.5);
      expect(placed.ink.left).toBeGreaterThanOrEqual(placed.fabric!.left+2.5);
      expect(placed.ink.right).toBeLessThanOrEqual(placed.fabric!.right-2.5);
    }
  }
});

it.each(['acrylic', 'solid'] as const)('keeps all %s/mixed material leader routes clear of measured roof pitch annotations', async boxMaterial => {
  const source = approvedDrawingSource(boxMaterial);
  const pdf = await PDFDocument.create(), fonts = await documentFonts(pdf);
  for (const product of [...source.products, approvedAcrylicBattensSource().products[0]]) {
    const scale = 72 / 25.4 / 40;
    const map = (p: {x:number;y:number;z:number}) => ({x: 500 + p.x * scale, y: 220 + p.y * scale});
    const hasSolid = product.covering?.regions.some(region => region.material === 'solid');
    const cases = hasSolid ? [{material:'solid' as const,side:'left' as const,heading:refinedSpecificationRows(product).find(([label])=>label==='ROOF')![1].toUpperCase(),vertical:-1 as const}, ...(product.assembly.roofCladdingPanels.length ? [{material:'acrylic' as const,side:'right' as const,heading:'ACRYLIC SKYLIGHT',vertical:1 as const}] : [])] : [{material:'acrylic' as const,side:'left' as const,heading:'ACRYLIC ROOF',vertical:-1 as const}];
    for (const entry of cases) {
      const target = await approvedPlanMaterialTarget(product, entry.material, map, fonts, entry.side, entry.heading, entry.vertical);
      const route = approvedLeaderRoute(map(target), entry.side, entry.vertical, entry.side==='left'?280:1014, await headingInkBounds(entry.heading,8.8));
      for (const bounds of approvedPitchFootprints(product,map,fonts)) {
        expect(segmentCrossesBounds(route.anchor,route.elbow,bounds)).toBe(false);
        expect(segmentCrossesBounds(route.elbow,route.tail,bounds)).toBe(false);
      }
      expect(Math.hypot(route.elbow.x-route.anchor.x,route.elbow.y-route.anchor.y)).toBeCloseTo(LEADER_LENGTH_PT,8);
      expect(target.x).toBeGreaterThan(0);expect(target.x).toBeLessThan(product.widthMm);
      expect(target.y).toBeGreaterThan(0);expect(target.y).toBeLessThan(product.projectionMm);
    }
  }
});

it.each([
  ["NONE", "BLIND HARDWARE"],
  ["FLASHING", "BLIND FLASHING"],
  ["PELMET", "BLIND PELMET"],
] as const)(
  "freezes actual %s cover geometry and labels its hardware without changing lowered fabrics",
  async (cover, label) => {
    const source = approvedCoverSource(cover);
    expect(
      source.products[0].drawingDetails!.blinds.map((blind) => blind.cover),
    ).toEqual([cover, cover, cover]);
    expect(
      source.products[0].drawingDetails!.blinds.map((blind) => blind.lowered),
    ).toEqual([100, 60, 100]);
    expect(
      parseStudioClientDocumentSource(source).products[0].drawingDetails!
        .blinds[0].cover,
    ).toBe(cover);
    const restored = await unpackStudioDrawing(await packStudioDrawing(source));
    expect(restored).toEqual(source);
    expect(approvedBlindCoverLabel(cover)).toBe(label);
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const sheet = source.pageManifest!.find(
        (entry) => entry.kind === "blind-plan",
      )!;
      const bytes = await renderStudioDocumentPage(source, sheet.index);
      expect(drawn.mock.calls.map(([value]) => value)).toContain(label);
      if (cover !== "PELMET")
        expect(drawn.mock.calls.map(([value]) => value)).not.toContain(
          "BLIND PELMET",
        );
      if (process.env.STUDIO_APPROVED_OUTPUT_DIR) {
        await mkdir(process.env.STUDIO_APPROVED_OUTPUT_DIR, {
          recursive: true,
        });
        await writeFile(
          `${process.env.STUDIO_APPROVED_OUTPUT_DIR}/Studio-Approved-Blind-${cover}-Plan.pdf`,
          bytes,
        );
      }
    } finally {
      drawn.mockRestore();
    }
  },
  15000,
);

it.each([null, "UNKNOWN", 0, {}])(
  "refuses a present unsupported frozen blind cover %j",
  (cover) => {
    const source = approvedCoverSource("FLASHING");
    (source.products[0].drawingDetails!.blinds[0] as any).cover = cover;
    expect(() => parseStudioClientDocumentSource(source)).toThrow(
      "Frozen selected drawing facts",
    );
  },
);

it.runIf(!!process.env.STUDIO_PRIOR_V3_RENDERER_MODULE)(
  "preserves exact old-v3 blind page bytes when the frozen selected-cover field is absent",
  async () => {
    const prior = await import(
      /* @vite-ignore */ pathToFileURL(
        process.env.STUDIO_PRIOR_V3_RENDERER_MODULE!,
      ).href
    );
    const source = approvedDrawingSource();
    for (const product of source.products)
      for (const blind of product.drawingDetails!.blinds) delete blind.cover;
    expect(approvedBlindCoverLabel()).toBe("BLIND PELMET");
    parseStudioClientDocumentSource(source);
    for (const sheet of source.pageManifest!.filter((entry) =>
      ["blind-plan", "blind-elevation"].includes(entry.kind),
    ))
      expect(await renderStudioDocumentPage(source, sheet.index)).toEqual(
        await prior.renderStudioDocumentPage(source, sheet.index),
      );
  },
  30000,
);
