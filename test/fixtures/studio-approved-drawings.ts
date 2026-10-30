import { studioClientDocumentFixture } from "./studio-client-documents";
import {
  addWebsitePergola,
  websiteComposition,
} from "../../apps/portal/lib/designStudio/websiteComposition";
import type { StudioWebsiteDesign } from "../../apps/portal/lib/designStudio/websiteDesign";
import { representativeBlindOpenings, pergolaLightSites } from "@sp/geometry";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import { defaultBlind, DEFAULT_LIGHTING } from "@sp/configurator/website";
import { projectStudioClientDocument } from "../../apps/portal/lib/designStudio/clientDocumentProjection.server";
import { STUDIO_DOCUMENT_COVER_LAYOUT_VERSION as STUDIO_DOCUMENT_LAYOUT_VERSION } from "../../packages/studio-documents/src/contract";

/** Canonical synthetic authoring path, never a live customer or price fixture. */
export function approvedDrawingEdit(
  boxMaterial: "acrylic" | "solid" = "acrylic",
) {
  const edit = addWebsitePergola(studioClientDocumentFixture(), "p3");
  const first = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  const second = edit.objectOptions[1].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  const third = edit.objectOptions[2].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  second.selection.roof.finish = {
    material: "acrylic",
    profile: "corrugated",
    trayWidth: 400,
    ceiling: "cedar-100",
    layout: "central",
    acrylicBays: 2,
  };
  third.selection.roof.family = "box";
  third.selection.roof.attachmentIntent = "freestanding";
  edit.spatial.pergolas[2].family = "box";
  third.rawDimensions = { widthMm: "6000", projectionMm: "3000" };
  third.selection.roof.finish = {
    material: boxMaterial,
    profile: "tray",
    trayWidth: 400,
    ceiling: "thermopine-150",
    layout: "central",
    acrylicBays: 2,
  };
  const rows = websiteComposition(edit);
  const geometry = rows.map((row) => {
    if (!row.design) throw Error("Synthetic design unavailable");
    const solved = solvePergolaPreview(
      row.design.input,
      row.design.roof,
      row.geometryOptions,
    ).geometry;
    if (!solved) throw Error("Synthetic geometry unavailable");
    return solved;
  });
  const openings = representativeBlindOpenings(geometry[0].assembly, {
    rearOpenings: true,
  });
  const selected = [
    ...openings.filter((o) => o.side === "front").slice(0, 2),
    ...openings.filter((o) => o.side === "left").slice(0, 1),
  ];
  if (selected.length !== 3)
    throw Error("Synthetic front and left openings unavailable");
  first.selection.roof.blinds = selected.map((opening, index) => ({
    ...defaultBlind(opening.id),
    cover: "PELMET" as const,
    lowered: index === 1 ? 60 : 100,
  }));
  first.selection.roof.lighting = {
    ...DEFAULT_LIGHTING,
    rafterAmount: "medium",
    cedarPerSection: 2,
    strips: ["house-beam", "outer-gutter"],
  };
  third.selection.roof.lighting = {
    ...DEFAULT_LIGHTING,
    rafterAmount: "medium",
    strips: pergolaLightSites(geometry[2].assembly, geometry[2].covering)
      .strips.filter((s) => s.perimeter)
      .map((s) => s.id),
  };
  return edit;
}
export function approvedDrawingSource(
  boxMaterial: "acrylic" | "solid" = "acrylic",
) {
  return projectStudioClientDocument(approvedDrawingEdit(boxMaterial), {
    layoutVersion: STUDIO_DOCUMENT_LAYOUT_VERSION,
    designVersionLabel: "V3",
    snapshotId: "10000000-0000-4000-8000-000000000006",
    contentHash: "a".repeat(64),
    projectName: "Synthetic Studio drawing integration",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
}

/** Full acrylic plus optional open battens uses the same ordinary authoring and
 * selected-light projection as the mixed and Box examples. */
export function approvedAcrylicBattensSource(
  battens = true,
  allBlindFaces = false,
  partialDrop = 60,
) {
  const edit = approvedDrawingEdit();
  const design = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  design.selection.roof.finish = {
    ...design.selection.roof.finish!,
    material: "acrylic",
  };
  design.selection.roof.blinds = [];
  if (battens)
    design.selection.roof.roofBattens = {
      species: "cedar",
      profile: "90x39",
      edge: false,
      gap: 90,
      customGap: false,
    };
  if (allBlindFaces) {
    const row = websiteComposition(edit)[0];
    if (!row.design) throw Error("Synthetic design unavailable");
    const geometry = solvePergolaPreview(
      row.design.input,
      row.design.roof,
      row.geometryOptions,
    ).geometry!;
    design.selection.roof.blinds = representativeBlindOpenings(
      geometry.assembly,
      { rearOpenings: true },
    ).map((opening, index) => ({
      ...defaultBlind(opening.id),
      cover: "FLASHING",
      lowered: index % 2 ? partialDrop : 100,
    }));
  }
  return projectStudioClientDocument(edit, {
    layoutVersion: STUDIO_DOCUMENT_LAYOUT_VERSION,
    designVersionLabel: "V3",
    snapshotId: "10000000-0000-4000-8000-000000000007",
    contentHash: "b".repeat(64),
    projectName: "Synthetic acrylic roof with open timber battens",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
}

/** Canonical cover variants use actual selected geometry, not relabelled meshes. */
export function approvedCoverSource(cover: "NONE" | "FLASHING" | "PELMET") {
  const edit = approvedDrawingEdit();
  const design = edit.objectOptions[0].values
    .websiteDesign as unknown as StudioWebsiteDesign;
  design.selection.roof.blinds = design.selection.roof.blinds!.map((blind) => ({
    ...blind,
    cover,
  }));
  return projectStudioClientDocument(edit, {
    layoutVersion: STUDIO_DOCUMENT_LAYOUT_VERSION,
    designVersionLabel: "V3",
    snapshotId: "10000000-0000-4000-8000-000000000008",
    contentHash: "c".repeat(64),
    projectName: "Synthetic selected blind covers",
    siteAddress: "",
    issuedAt: "2026-10-29T00:00:00Z",
    issuedDate: "29 OCT 2026",
  });
}
