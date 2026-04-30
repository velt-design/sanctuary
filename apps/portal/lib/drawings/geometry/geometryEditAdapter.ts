import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { CalculatorHouseAttachmentStrategy } from '@/lib/types/calculator';
import type { ObjectWorkbenchPergolaPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import {
  applyGeometryEditIntent as applyObjectWorkbenchGeometryEditIntent,
  buildGeometryEditState as buildObjectWorkbenchGeometryEditState,
  mirrorPergolaPatchToTemporaryGeometryModuleFields,
  translateEstimateDrawingFieldToGeometryIntent as translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent,
  translateFootprintEditToGeometryIntent as translateFootprintEditToObjectWorkbenchGeometryIntent,
  type GeometryEditApplyResult,
  type GeometryEditIntent,
} from './compat/geometryEditAdapter';

export {
  applyObjectWorkbenchGeometryEditIntent,
  applyObjectWorkbenchGeometryEditIntent as applyGeometryEditIntent,
  buildObjectWorkbenchGeometryEditState,
  buildObjectWorkbenchGeometryEditState as buildGeometryEditState,
  translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent,
  translateEstimateDrawingFieldToObjectWorkbenchGeometryIntent as translateEstimateDrawingFieldToGeometryIntent,
  translateFootprintEditToObjectWorkbenchGeometryIntent,
  translateFootprintEditToObjectWorkbenchGeometryIntent as translateFootprintEditToGeometryIntent,
};

export type {
  GeometryEditApplyResult as ObjectWorkbenchGeometryEditApplyResult,
  GeometryEditConnectionType as ObjectWorkbenchGeometryConnectionType,
  GeometryEditHouseAttachmentStrategy as ObjectWorkbenchGeometryHouseAttachmentStrategy,
  GeometryEditIntent as ObjectWorkbenchGeometryEditIntent,
  GeometryEditState as ObjectWorkbenchGeometryEditState,
  GeometryEditStateResult as ObjectWorkbenchGeometryEditStateResult,
  GeometryHouseConfigKey as ObjectWorkbenchGeometryHouseConfigKey,
  SanctuaryPergolaFamily as ObjectWorkbenchPergolaFamily,
} from './compat/geometryEditAdapter';

export function buildObjectWorkbenchPergolaPatchFromGeometryIntent(
  intent: GeometryEditIntent,
): ObjectWorkbenchPergolaPatch | null {
  switch (intent.type) {
    case 'family':
      return {
        family: intent.value,
        geometry: {
          roof: {
            boxPerimeterEnabled: intent.value === 'box',
          },
        },
      };
    case 'dimension':
      return {
        geometry: {
          dimensions: {
            [intent.field]: intent.value,
          },
        },
      };
    case 'roof_material':
      return {
        geometry: {
          roof: {
            material: intent.value,
          },
        },
      };
    case 'roof_pitch':
      return {
        geometry: {
          roof: {
            pitchDeg: intent.value,
          },
        },
      };
    case 'mixed_acrylic_bays':
      return {
        geometry: {
          roof: {
            [intent.field]: intent.value,
          },
        },
      };
    case 'gable_end_frames':
      return {
        geometry: {
          gable: {
            endFramesMode: intent.value,
          },
        },
      };
    case 'house_connection':
      return {
        connectionKind: intent.value,
      };
    case 'house_config':
      if (intent.key !== 'houseAttachmentStrategy') return null;
      return {
        strategy:
          intent.value === 'auto'
            ? null
            : (intent.value as CalculatorHouseAttachmentStrategy),
      };
    case 'attachment_side':
      return {
        side: intent.value,
      };
    case 'post_connection':
      return {
        geometry: {
          supports: {
            postConnectionType: intent.value,
          },
        },
      };
    case 'ground':
      return {
        geometry: {
          supports: {
            ground: intent.value,
          },
        },
      };
    case 'post_count':
      return {
        geometry: {
          supports: {
            postCount: intent.value,
          },
        },
      };
    case 'post_cut_height':
      return {
        geometry: {
          supports: {
            postCutHeightM: intent.value,
          },
        },
      };
    case 'override':
      return {
        geometry: {
          overrides: {
            [intent.key]: intent.value,
          },
        },
      };
    default:
      return null;
  }
}

export function mirrorObjectWorkbenchPergolaPatchToTemporaryGeometryModuleFields(input: {
  snapshot: Record<string, unknown> | null;
  draft: EstimateDrawingDraft;
  moduleIndexes: number[];
  patch: ObjectWorkbenchPergolaPatch;
}): GeometryEditApplyResult {
  return mirrorPergolaPatchToTemporaryGeometryModuleFields(input);
}
