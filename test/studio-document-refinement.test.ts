// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { PDFDocument, PDFPage } from "pdf-lib";
import { studioClientDocumentFixture } from "./fixtures/studio-client-documents";
import {
  studioDocumentCapacityFixture,
  studioDocumentSelectionsFixture,
} from "./fixtures/studio-client-document-capacity";
import { projectStudioClientDocument } from "../apps/portal/lib/designStudio/clientDocumentProjection.server";
import {
  STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION as STUDIO_DOCUMENT_LAYOUT_VERSION,
  parseStudioClientDocumentSource,
  studioDocumentPages,
  studioDocumentLayoutVersion,
} from "../packages/studio-documents/src/contract";
import {
  packStudioDrawing,
  unpackStudioDrawing,
  studioArchiveJsonBytes,
} from "../packages/studio-documents/src/transport";
import { renderStudioDocumentPage } from "../packages/studio-documents/src/render";
import { fonts as documentFonts } from "../packages/studio-documents/src/assets";
import { refinedCoverLayout } from "../packages/studio-documents/src/refinedCover";
import { refinedSupplement } from "../packages/studio-documents/src/refinedLayout";
import {
  refinedHeightFacts,
  refinedSpecificationRows,
  refinedExtras,
} from "../packages/studio-documents/src/refinedFacts";
import { studioDocumentHeightFacts } from "../packages/studio-documents/src/facts";
import type { StudioWebsiteDesign } from "../apps/portal/lib/designStudio/websiteDesign";

function fixture(edit = studioClientDocumentFixture()) {
  return projectStudioClientDocument(edit, {
    designVersionLabel: "V2",
    snapshotId: "10000000-0000-4000-8000-000000000002",
    contentHash: "a".repeat(64),
    projectName: "Synthetic courtyard",
    siteAddress: "12 Example Road",
    issuedDate: "29 OCT 2026",
    issuedAt: "2026-10-29T00:00:00Z",
  });
}
async function pageText(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"),
    document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const content = await (await document.getPage(1)).getTextContent();
  const items = content.items.filter(
    (item): item is Extract<typeof item, { str: string }> => "str" in item,
  );
  await document.destroy();
  return {
    items,
    text: items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " "),
  };
}
it("freezes the new layout inside the full logical drawing archive and refuses unknown selectors without changing the renderer contract", async () => {
  const legacy = fixture(),
    source = { ...legacy, layoutVersion: STUDIO_DOCUMENT_LAYOUT_VERSION };
  expect(studioDocumentLayoutVersion(legacy)).toBe("legacy");
  expect(parseStudioClientDocumentSource(source).layoutVersion).toBe(
    STUDIO_DOCUMENT_LAYOUT_VERSION,
  );
  const packed = await packStudioDrawing(source),
    decoded = await unpackStudioDrawing(packed);
  expect(decoded).toEqual(source);
  expect(decoded.rendererVersion).toBe("studio-booklet.v1");
  const hash = (value: unknown) =>
    createHash("sha256").update(studioArchiveJsonBytes(value)).digest("hex");
  expect(hash(decoded)).not.toBe(hash(legacy));
  expect(() =>
    parseStudioClientDocumentSource({ ...source, layoutVersion: "unknown" }),
  ).toThrow();
  expect(() =>
    studioDocumentLayoutVersion({ ...source, layoutVersion: "unknown" } as any),
  ).toThrow();
  const before = structuredClone(source),
    a = await renderStudioDocumentPage(source, 0),
    b = await renderStudioDocumentPage(source, 0);
  expect(a).toEqual(b);
  expect(source).toEqual(before);
  expect(a).not.toEqual(await renderStudioDocumentPage(legacy, 0));
}, 15000);

it("uses main horizontal bearing geometry for named beam heights and retains the legacy broader fact unchanged", () => {
  const product = fixture().products[0],
    expected = refinedHeightFacts(product),
    main = product.assembly.members.find(
      (m) => m.role === "beam" && !m.metadata?.frameRole,
    )!;
  const finish = structuredClone(main);
  finish.id = "synthetic-sloping-finish-transition";
  finish.centerline.start.z -= 1.5;
  finish.centerline.end.z -= 40;
  product.assembly.members.push(finish);
  const old = studioDocumentHeightFacts(product),
    refined = refinedHeightFacts(product);
  expect(old.eaves[0]).toBeLessThan(refined.low);
  expect(refined).toEqual(expected);
  expect(refined.low).toBe(2400);
  expect(refined.high).toBeGreaterThan(refined.low);
  const gable = fixture().products[1],
    facts = refinedHeightFacts(gable);
  expect(facts.low).toBe(2600);
  expect(facts.high).toBe(2600);
  expect(facts.ridgeTop).toBeGreaterThan(2600);
  expect(studioDocumentHeightFacts(product)).toEqual(old);
}, 15000);

it("keeps ordinary specifications explicit and complete and preserves selected battens, tint and optional extras in overflow schedules", async () => {
  const pdf = await PDFDocument.create(),
    fonts = await documentFonts(pdf),
    source = fixture();
  expect(refinedSupplement(source.products[0], fonts)).toBeNull();
  const rows = refinedSpecificationRows(source.products[1]);
  expect(rows.some(([label, value]) => label === "TIES" && !!value)).toBe(true);
  expect(
    rows.some(([label, value]) => label === "GUTTER" && /mm wide/.test(value)),
  ).toBe(true);
  expect(JSON.stringify(rows)).not.toContain("sp gutter");
  const many = studioDocumentSelectionsFixture().products[0];
  const edit = studioClientDocumentFixture();
  const design = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  design.selection.roof.roofBattens = {
    species: "cedar",
    profile: "90x39",
    edge: true,
    gap: 40,
    customGap: true,
  };
  const withBattens = fixture(edit).products[0];
  expect(
    withBattens.selectedDetails.some((detail) =>
      detail.startsWith("Under-rafter timber battens:"),
    ),
  ).toBe(true);
  many.roofMaterial = withBattens.roofMaterial;
  expect(
    refinedSpecificationRows(many).find(([label]) => label === "BATTENS")?.[1],
  ).toContain("acrylic roof sections only");
  const supplement = refinedSupplement(many, fonts)!;
  for (const detail of [
    ...many.extras.infills,
    ...many.extras.blinds,
    ...many.extras.lights,
  ])
    expect(supplement.rows).toContain(detail);
  expect(
    supplement.rows.some((row) => row.includes("Under-rafter timber battens")),
  ).toBe(true);
  expect(supplement.top).toBeGreaterThanOrEqual(314);
  expect(refinedExtras(many).every((row) => row.selected)).toBe(true);
});

it("retains the approved ordinary right register and all65 exceptional entries with maximum names at readable measured positions", async () => {
  const pdf = await PDFDocument.create(),
    fonts = await documentFonts(pdf),
    ordinary = fixture();
  ordinary.layoutVersion = STUDIO_DOCUMENT_LAYOUT_VERSION;
  const normal = refinedCoverLayout(
    ordinary,
    studioDocumentPages(ordinary),
    fonts.regular,
    fonts.semibold,
  );
  expect(normal.ordinary).toBe(true);
  expect(normal.register.every((row) => row.x === 824)).toBe(true);
  const capacity = studioDocumentCapacityFixture();
  capacity.layoutVersion = STUDIO_DOCUMENT_LAYOUT_VERSION;
  const layout = refinedCoverLayout(
    capacity,
    studioDocumentPages(capacity),
    fonts.regular,
    fonts.semibold,
  );
  expect(layout.register).toHaveLength(65);
  expect(layout.registerBottom).toBeLessThanOrEqual(700);
  expect(
    layout.register.every(
      (row) => row.x >= 824 && row.x + row.width <= 1148 && row.size >= 8.8,
    ),
  ).toBe(true);
  const { items, text } = await pageText(
    await renderStudioDocumentPage(capacity, 0),
  );
  for (let index = 0; index < 65; index++)
    expect(text).toContain(`A${String(index).padStart(2, "0")}`);
  expect(text.replace(/\s/g, "")).toContain(capacity.projectName);
  expect(text).not.toContain("P01 / Pitched");
  for (const item of items) {
    expect(item.transform[4]).toBeGreaterThanOrEqual(28 - 0.1);
    expect(item.transform[4] + item.width).toBeLessThanOrEqual(1162 + 0.1);
  }
}, 15000);

it("keeps the complete long iso title above the opaque raster and full exceptional selections on their matching drawing", async () => {
  const capacity = studioDocumentCapacityFixture();
  capacity.layoutVersion = STUDIO_DOCUMENT_LAYOUT_VERSION;
  const draw = vi.spyOn(PDFPage.prototype, "drawImage");
  try {
    const { text, items } = await pageText(
      await renderStudioDocumentPage(capacity, 64),
    );
    expect(text.replace(/\s/g, "")).toContain(
      capacity.products[31].label.toUpperCase(),
    );
    const subtitle = items.find(
      (item) => item.str === "ISOMETRIC / ORTHOGRAPHIC / NTS",
    )!;
    const [, placement] = draw.mock.calls.at(-1)!;
    expect(841.89 - placement!.y! - placement!.height!).toBeGreaterThanOrEqual(
      841.89 - subtitle.transform[5] + 15.9,
    );
  } finally {
    draw.mockRestore();
  }
  const selected = studioDocumentSelectionsFixture();
  selected.layoutVersion = STUDIO_DOCUMENT_LAYOUT_VERSION;
  const { text, items } = await pageText(
    await renderStudioDocumentPage(selected, 1),
  );
  for (const detail of [
    ...selected.products[0].extras.infills,
    ...selected.products[0].extras.blinds,
    ...selected.products[0].extras.lights,
  ])
    expect(text.replace(/\s/g, "")).toContain(detail.replace(/\s/g, ""));
  expect(text).toContain("SELECTED OPTIONS / COMPLETE SCHEDULE");
  expect(text.split("SELECTED OPTIONS / COMPLETE SCHEDULE")[0]).not.toContain(
    "Front 2:",
  );
  const fonts = await documentFonts(await PDFDocument.create());
  const supplement = refinedSupplement(selected.products[0], fonts)!;
  for (const item of items.filter(
    (item) => item.str === "Complete schedule below.",
  )) {
    expect(841.89 - item.transform[5]).toBeLessThan(supplement.top - 6);
  }
  const iso = await pageText(await renderStudioDocumentPage(selected, 2));
  const note = iso.items.find(
    (item) => item.str === "Complete selected-options schedule below.",
  )!;
  expect(note).toBeDefined();
  expect(841.89 - note.transform[5]).toBeLessThan(supplement.top - 6);
}, 20000);
