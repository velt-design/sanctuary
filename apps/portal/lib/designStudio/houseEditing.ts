import type {
  ObjectFirstHouseFormDraft as House,
  ObjectFirstWorkbenchDraftVNext,
} from "../drawings/state/objectFirstWorkbenchModel";
import {
  buildDefaultHouseAssemblyDraft,
  buildDefaultHouseFormDraft,
} from "../drawings/state/houseFormDraftFactory";
import { deriveRectangleRoofIntent } from "../drawings/state/houseFormCompositionAdapter";
import { deriveHouseFormDisplayLabel } from "../drawings/state/houseFormDisplayLabel";
import { parseStudioSpatialDraft } from "./spatialValidation";

export type StudioHouseDetails = Partial<
  Pick<
    House,
    | "label"
    | "storeyMode"
    | "eaveHeightM"
    | "wallHeightM"
    | "soffitDepthMm"
    | "fasciaHeightMm"
    | "gutterWidthMm"
    | "gutterDepthMm"
    | "gutterProjectionMm"
    | "eaveOverhangMm"
  >
>;
export type StudioHouseEdit =
  | { kind: "add"; id: string; label?: string }
  | { kind: "duplicate"; houseFormId: string; id: string; label?: string }
  | { kind: "remove"; houseFormId: string }
  | { kind: "details"; houseFormId: string; patch: StudioHouseDetails }
  | {
      kind: "appearance";
      houseFormId: string;
      patch: NonNullable<House["appearance"]>;
    }
  | {
      kind: "rectangle";
      houseFormId: string;
      primitiveIndex: number;
      patch: Partial<
        Record<"widthMm" | "depthMm" | "originXMm" | "originYMm", number>
      >;
    }
  | { kind: "roof"; houseFormId: string; roof: House["roofIntent"] }
  | {
      kind: "move";
      houseFormId: string;
      position: NonNullable<House["position"]>;
    };

const details = [
  "label",
  "storeyMode",
  "eaveHeightM",
  "wallHeightM",
  "soffitDepthMm",
  "fasciaHeightMm",
  "gutterWidthMm",
  "gutterDepthMm",
  "gutterProjectionMm",
  "eaveOverhangMm",
];
function exactKeys(value: object, allowed: string[]) {
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    throw Error("Unsupported house edit field.");
}
function numeric(value: string, name: string) {
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ||
    !Number.isFinite(Number(value))
  )
    throw Error(`Enter a valid ${name}.`);
  return Number(value);
}

/** Canonical authoring only. Structural ingress is checked before and after edits;
 * values are never normalized or borrowed from calculator house carriers. This
 * does not establish geometry, engineering or pricing readiness. */
export function applyStudioHouseEdit(
  spatial: unknown,
  edit: StudioHouseEdit,
):
  | {
      ok: true;
      spatial: ObjectFirstWorkbenchDraftVNext;
      houseFormId: string | null;
    }
  | { ok: false; message: string } {
  try {
    const parsed = parseStudioSpatialDraft(spatial);
    if (!parsed.ok) throw Error(parsed.message);
    const next = parsed.value;
    const keys = {
      add: ["kind", "id", "label"],
      duplicate: ["kind", "houseFormId", "id", "label"],
      remove: ["kind", "houseFormId"],
      details: ["kind", "houseFormId", "patch"],
      appearance: ["kind", "houseFormId", "patch"],
      rectangle: ["kind", "houseFormId", "primitiveIndex", "patch"],
      roof: ["kind", "houseFormId", "roof"],
      move: ["kind", "houseFormId", "position"],
    };
    if (!edit || !(edit.kind in keys)) throw Error("Unsupported house edit.");
    exactKeys(edit, keys[edit.kind]);
    let selected: string | null;
    if (edit.kind === "add" || edit.kind === "duplicate") {
      const assembly = next.houseAssembly ?? buildDefaultHouseAssemblyDraft();
      const source =
        edit.kind === "duplicate"
          ? assembly.houseForms.find((form) => form.id === edit.houseFormId)
          : null;
      if (edit.kind === "duplicate" && !source)
        throw Error("The selected house is no longer available.");
      const label =
        edit.label ?? deriveHouseFormDisplayLabel(assembly.houseForms.length);
      // Composition identity is its ordered primitive indexes; copying preserves
      // those indexes/joins in the new independent form, with no aliasing.
      const form = source
        ? { ...structuredClone(source), id: edit.id, label }
        : buildDefaultHouseFormDraft({ id: edit.id, label });
      if (!source) {
        // Studio's new-house default only. Shared creation and saved copies retain
        // their existing intent, including its original field presence.
        form.roofIntent = { ...form.roofIntent, primaryPitchDeg: "15" };
        form.wallHeightM = "2.7";
        form.eaveHeightM = "2.7";
        const primitive = form.composition.primitives[0];
        if (primitive.kind === "axisAlignedRectangle") {
          primitive.widthMm = 12000;
          primitive.depthMm = 8000;
          primitive.roofIntent = deriveRectangleRoofIntent({
            roofIntent: form.roofIntent,
            widthMm: primitive.widthMm,
            depthMm: primitive.depthMm,
          });
        }
      }
      next.houseAssembly = {
        ...assembly,
        houseForms: [...assembly.houseForms, form],
      };
      selected = edit.id;
    } else {
      const assembly = next.houseAssembly;
      const form = assembly?.houseForms.find(
        (item) => item.id === edit.houseFormId,
      );
      if (!assembly || !form)
        throw Error("The selected house is no longer available.");
      selected = form.id;
      switch (edit.kind) {
        case "remove": {
          const referenced =
            next.pergolas.some(
              (item) =>
                item.attachment?.host?.objectId === form.id ||
                (!item.attachment?.host &&
                  (item.attachmentEdgeId !== null ||
                    item.attachmentZoneId !== null)),
            ) ||
            next.decks.some(
              (item) =>
                item.attachment?.host?.objectId === form.id ||
                (!item.attachment?.host &&
                  (item.isAttached ||
                    item.hostEdgeId !== null ||
                    item.primaryHostEdgeId != null ||
                    item.secondaryHostEdgeId != null)),
            ) ||
            next.openings.some(
              (item) =>
                item.sourceFormId === form.id ||
                (!item.sourceFormId &&
                  (item.hostWallId !== null ||
                    item.hostEdgeId != null ||
                    item.wallId != null)),
            );
          if (referenced)
            throw Error(
              "Detach the house references before removing this house.",
            );
          assembly.houseForms = assembly.houseForms.filter(
            (item) => item.id !== form.id,
          );
          if (!assembly.houseForms.length) next.houseAssembly = null;
          selected = assembly.houseForms[0]?.id ?? null;
          break;
        }
        case "details":
          exactKeys(edit.patch, details);
          Object.assign(form, structuredClone(edit.patch));
          break;
        case "appearance":
          exactKeys(edit.patch, [
            "wallMaterial",
            "roofProfile",
            "roofTrayWidth",
            "roofColour",
          ]);
          form.appearance = {
            ...form.appearance,
            ...structuredClone(edit.patch),
          };
          break;
        case "rectangle": {
          exactKeys(edit.patch, [
            "widthMm",
            "depthMm",
            "originXMm",
            "originYMm",
          ]);
          const primitive = form.composition.primitives[edit.primitiveIndex];
          if (!Number.isSafeInteger(edit.primitiveIndex) || !primitive)
            throw Error("Select a current rectangle.");
          if (
            Object.values(edit.patch).some(
              (value) => typeof value !== "number" || !Number.isFinite(value),
            )
          )
            throw Error("Rectangle values must be finite millimetres.");
          // Zero/negative finite dimensions stay explicit invalid geometry, never
          // silently replaced by a default rectangle. The solver owns diagnostics.
          Object.assign(primitive, edit.patch);
          break;
        }
        case "roof": {
          if (
            form.composition.primitives.length !== 1 ||
            form.composition.joins.length
          )
            throw Error(
              "Edit joined roof sections through the composition controls.",
            );
          const pitch = numeric(edit.roof.primaryPitchDeg, "roof pitch");
          if (pitch < 0 || pitch >= 90)
            throw Error(
              "Roof pitch must be at least zero and less than 90 degrees.",
            );
          form.roofIntent = structuredClone(edit.roof);
          form.roofIntentAuthored = true;
          // Check the raw intent before the legacy-compatible owner can coerce it.
          const checked = parseStudioSpatialDraft(next);
          if (!checked.ok) throw Error(checked.message);
          const primitive = form.composition.primitives[0];
          if (primitive.kind !== "axisAlignedRectangle")
            throw Error("Unsupported house primitive.");
          primitive.roofIntent = deriveRectangleRoofIntent({
            roofIntent: form.roofIntent,
            widthMm: primitive.widthMm,
            depthMm: primitive.depthMm,
          });
          break;
        }
        case "move": {
          exactKeys(edit.position, ["originXMm", "originYMm", "rotationDeg"]);
          const x = numeric(edit.position.originXMm, "house X position"),
            y = numeric(edit.position.originYMm, "house Y position"),
            rotation = numeric(edit.position.rotationDeg, "house rotation");
          form.position = structuredClone(edit.position);
          form.transform = {
            offsetXM: x / 1000,
            offsetYM: y / 1000,
            rotationQuarterTurns: (((Math.round(rotation / 90) % 4) + 4) %
              4) as 0 | 1 | 2 | 3,
          };
          break;
        }
      }
    }
    const checked = parseStudioSpatialDraft(next);
    if (!checked.ok) throw Error(checked.message);
    return { ok: true, spatial: checked.value, houseFormId: selected };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "House edit is unavailable.",
    };
  }
}
