import type {
  ObjectFirstHouseFormDraft as House,
  ObjectFirstWorkbenchDraftVNext as Spatial,
} from "../drawings/state/objectFirstWorkbenchModel";
import { buildWorkbenchProjectModelFromObjectFirstDraft } from "../drawings/state/objectFirstWorkbenchModel";
import { buildProjectHouseGeometryRegistry } from "../drawings/state/projectHouseGeometryRegistry";
import {
  validateWebsiteAttachments,
  type StudioHouse,
  type StudioHouseScene,
} from "./studioAttachmentContract";
export * from "./studioAttachmentContract";
const millimetresForDisplay = (raw: string) =>
  Number.isFinite(Number(raw)) ? String(Number(raw) * 1000) : raw;
const fall = {
  negative_y: "front",
  positive_y: "rear",
  negative_x: "left",
  positive_x: "right",
} as const;
export function studioHousePose(form: House) {
  const p = form.composition.primitives[0];
  if (p?.kind !== "axisAlignedRectangle")
    throw Error("Unsupported house primitive.");
  const rotation = Number(
      form.position?.rotationDeg ?? form.transform.rotationQuarterTurns * 90,
    ),
    r = (rotation * Math.PI) / 180;
  return {
    xMm: String(
      Number(form.position?.originXMm ?? form.transform.offsetXM * 1000) +
        p.originXMm * Math.cos(r) -
        p.originYMm * Math.sin(r),
    ),
    yMm: String(
      Number(form.position?.originYMm ?? form.transform.offsetYM * 1000) +
        p.originXMm * Math.sin(r) +
        p.originYMm * Math.cos(r),
    ),
    rotationDeg: String(rotation),
  };
}
export function canonicalHouseProjection(
  form: House,
  spatial: Spatial,
): StudioHouse {
  const p = form.composition.primitives[0];
  if (
    form.composition.primitives.length !== 1 ||
    form.composition.joins.length ||
    p?.kind !== "axisAlignedRectangle" ||
    !["flat", "mono", "hipped"].includes(form.roofIntent.form)
  )
    throw Error(
      "This saved house cannot be edited as a simple rectangle. Its original design is retained.",
    );
  const local = structuredClone(form);
  local.composition.primitives[0] = { ...p, originXMm: 0, originYMm: 0 };
  local.transform = { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 };
  delete local.position;
  const model = buildProjectHouseGeometryRegistry(
    buildWorkbenchProjectModelFromObjectFirstDraft({
      ...spatial,
      pergolas: [],
      houseAssembly: { ...spatial.houseAssembly!, houseForms: [local] },
    }),
  )[0]?.model;

  return {
    id: form.id,
    label: form.label,
    widthMm: String(p.widthMm),
    depthMm: String(p.depthMm),
    wallHeightMm:
      form.wallHeightM !== undefined &&
      form.wallHeightM !== null &&
      form.wallHeightM !== ""
        ? millimetresForDisplay(form.wallHeightM)
        : String(
            Math.max(
              ...(model?.wallSegments.flatMap((w) =>
                w.boundary.map((p) => p.z),
              ) ?? []),
            ),
          ),
    eaveHeightMm: form.eaveHeightM
      ? millimetresForDisplay(form.eaveHeightM)
      : "",
    roof: {
      form: form.roofIntent.form as StudioHouse["roof"]["form"],
      pitchDeg: form.roofIntent.primaryPitchDeg,
      fall: fall[form.roofIntent.primaryFallDirection],
      ridge: form.roofIntent.ridgeAxis === "x" ? "width" : "depth",
      overhangMm: String(
        form.eaveOverhangMm ?? model?.eave?.eaveOverhangMm ?? 0,
      ),
      ...(form.fasciaHeightMm ? { fasciaHeightMm: form.fasciaHeightMm } : {}),
    },
    position: studioHousePose(form),
    source: structuredClone(form),
  };
}
export function studioHouseScene(
  site: { websiteAttachments?: unknown } | undefined,
  spatial?: Spatial,
): StudioHouseScene | null {
  if (!spatial) return null;
  return {
    schemaVersion: "studio_house_scene.v1",
    houses: (spatial.houseAssembly?.houseForms ?? []).map((h) =>
      canonicalHouseProjection(h, spatial),
    ),
    attachments: validateWebsiteAttachments(site, spatial),
  };
}
/** Pending local form data only, never accepted by the authoring API. */
export function parseStudioHouseScene(value: unknown): StudioHouseScene {
  const v = value as StudioHouseScene;
  if (
    v?.schemaVersion !== "studio_house_scene.v1" ||
    !Array.isArray(v.houses) ||
    v.houses.some((h) => !h.source || h.source.id !== h.id)
  )
    throw Error("Unsupported pending house.");
  return structuredClone(v);
}
