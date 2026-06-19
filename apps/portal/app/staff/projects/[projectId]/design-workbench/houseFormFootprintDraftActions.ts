import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { ObjectFirstHouseFormDraft } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { reconcileHouseFormRoofIntentForFootprint } from '@/lib/drawings/state/houseFormRoofIntentForFootprint';
import {
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPosition,
  normalizeHouseFootprintPreset,
} from '@/lib/types/calculator';

export function applyHouseFormFootprintEdit(input: {
  houseForms: ObjectFirstHouseFormDraft[];
  houseFormId: string;
  edit: EstimateDrawingFootprintEdit;
}): { ok: true; houseForms: ObjectFirstHouseFormDraft[] } | { ok: false; error: string } {
  let found = false;
  const houseForms = input.houseForms.map((houseForm) => {
    if (houseForm.id !== input.houseFormId) return houseForm;
    found = true;

    const footprint = houseForm.footprint;
    const nextHouseForm = (() => {
      switch (input.edit.type) {
      case 'mode':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            mode: normalizeHouseFootprintMode(input.edit.mode),
          },
        };
      case 'preset':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            preset: normalizeHouseFootprintPreset(input.edit.preset),
          },
        };
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
          footprint: {
            ...footprint,
            attachmentSide: normalizeAttachmentSide(input.edit.side),
          },
        };
      case 'param':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            params: {
              ...normalizeHouseFootprintParams(footprint.params),
              [input.edit.key]: input.edit.value,
            },
          },
        };
      case 'polygon':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            polygon: normalizeHouseFootprintPolygon(input.edit.polygon),
          },
        };
      case 'custom_polygon':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            mode: 'custom_polygon' as const,
            polygon: normalizeHouseFootprintPolygon(input.edit.polygon),
          },
        };
      case 'preset_resize': {
        // PR-WB-RESIZE-KEEPS-PRESET (2026-06-19): atomic update of
        // widthM / bandDepthM / offsetXM / setbackM for a
        // preset+straight form whose axis-aligned resize was
        // converted by tryConvertResizeToPresetParams. Mode stays
        // 'preset', polygon is cleared (preset polygon is derived
        // from params); composition is re-synced by the normaliser
        // on persist.
        const nextParams = {
          ...normalizeHouseFootprintParams(footprint.params),
          widthM: input.edit.widthM,
          bandDepthM: input.edit.bandDepthM,
          offsetXM: input.edit.offsetXM,
          setbackM: input.edit.setbackM,
        };
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            mode: 'preset' as const,
            polygon: [],
            params: nextParams,
          },
        };
      }
      case 'position':
        return {
          ...houseForm,
          footprint: {
            ...footprint,
            position: normalizeHouseFootprintPosition(input.edit.position),
          },
        };
      default:
        return houseForm;
      }
    })();
    return reconcileHouseFormRoofIntentForFootprint(nextHouseForm);
  });

  if (!found) {
    return { ok: false, error: `House form ${input.houseFormId} not found.` };
  }
  return { ok: true, houseForms };
}
