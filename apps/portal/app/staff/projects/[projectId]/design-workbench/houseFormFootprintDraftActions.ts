import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  ObjectFirstHouseFormDraft,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { reconcileHouseFormRoofIntentForFootprint } from '@/lib/drawings/state/houseFormRoofIntentForFootprint';
import {
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintPosition,
} from '@/lib/types/calculator';
import {
  isAxisAlignedRectangle,
  type HouseComposition,
} from '@sp/geometry';

/**
 * PR-WB-COMPOSITION-ONLY (2026-06-19): edit applier for the
 * surviving footprint edit types. The retired types ('mode',
 * 'preset', 'param', 'polygon', 'custom_polygon', 'preset_resize')
 * had no path that wrote into the composition; they all mutated
 * the legacy `footprint.{mode,preset,params,polygon}` sub-object,
 * which is now gone.
 *
 * Surviving types:
 *   - 'rotate' — quarter-turn the form's transform
 *   - 'attachment_side' — change which pergola side it attaches to
 *   - 'position' — set the world-space position
 *   - 'composition_resize' — atomic rectangle resize of a single-
 *     primitive composition + compensating transform shift
 */
export function applyHouseFormFootprintEdit(input: {
  houseForms: ObjectFirstHouseFormDraft[];
  houseFormId: string;
  edit: EstimateDrawingFootprintEdit;
}): { ok: true; houseForms: ObjectFirstHouseFormDraft[] } | { ok: false; error: string } {
  let found = false;
  let errorMessage: string | null = null;
  const houseForms = input.houseForms.map((houseForm) => {
    if (houseForm.id !== input.houseFormId) return houseForm;
    found = true;

    const nextHouseForm = ((): ObjectFirstHouseFormDraft => {
      switch (input.edit.type) {
        case 'rotate':
          return {
            ...houseForm,
            transform: {
              ...houseForm.transform,
              rotationQuarterTurns: normalizeDrawingRotationQuarterTurns(
                houseForm.transform.rotationQuarterTurns + input.edit.delta,
              ),
            },
          };
        case 'attachment_side':
          return {
            ...houseForm,
            attachmentSide: normalizeAttachmentSide(input.edit.side),
          };
        case 'position':
          return {
            ...houseForm,
            position: normalizeHouseFootprintPosition(input.edit.position),
          };
        case 'composition_resize': {
          if (houseForm.composition.primitives.length !== 1) {
            errorMessage =
              'Resize is only supported on single-rectangle forms. Detach the composite first.';
            return houseForm;
          }
          const primitive = houseForm.composition.primitives[0]!;
          if (!isAxisAlignedRectangle(primitive)) {
            errorMessage = 'Resize requires an axis-aligned rectangle.';
            return houseForm;
          }
          const nextComposition: HouseComposition = {
            primitives: [
              {
                ...primitive,
                originXMm: input.edit.originXMm,
                originYMm: input.edit.originYMm,
                widthMm: input.edit.widthMm,
                depthMm: input.edit.depthMm,
              },
            ],
            joins: [],
          };
          return {
            ...houseForm,
            composition: nextComposition,
            transform: {
              ...houseForm.transform,
              offsetXM: houseForm.transform.offsetXM + input.edit.transformDeltaXM,
              offsetYM: houseForm.transform.offsetYM + input.edit.transformDeltaYM,
            },
          };
        }
        // Deprecated edit types (legacy estimate sheet UI). No-op.
        case 'mode':
        case 'preset':
        case 'param':
        case 'polygon':
        case 'custom_polygon':
          return houseForm;
        default: {
          const _exhaustive: never = input.edit;
          void _exhaustive;
          return houseForm;
        }
      }
    })();
    return reconcileHouseFormRoofIntentForFootprint(nextHouseForm);
  });

  if (errorMessage !== null) {
    return { ok: false, error: errorMessage };
  }
  if (!found) {
    return { ok: false, error: `House form ${input.houseFormId} not found.` };
  }
  return { ok: true, houseForms };
}
