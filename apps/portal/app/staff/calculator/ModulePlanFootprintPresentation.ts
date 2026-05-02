import type { ModulePlanModel } from './moduleViews';

export const HOUSE_FOOTPRINT_PRESET_OPTIONS: Array<{ id: ModulePlanModel['houseFootprintPreset']; label: string }> = [
  { id: 'straight', label: 'Straight' },
  { id: 'l_left', label: 'L left' },
  { id: 'l_right', label: 'L right' },
  { id: 'recess_left', label: 'Recess left' },
  { id: 'recess_right', label: 'Recess right' },
  { id: 'u_shape', label: 'U shape' },
  { id: 'wrap_left', label: 'Wrap left' },
  { id: 'wrap_right', label: 'Wrap right' },
];

export function canEditHouseFootprintPlan(model?: ModulePlanModel | null): boolean {
  return Boolean(model && model.houseConnectionType !== 'none' && model.supportsHouseFootprints && model.roofType !== 'hip_corner');
}

export {
  actualPergolaCenter,
  footprintLabelPoint,
  localFootprintDimensionsM,
  mapLocalFootprintPointToPlan,
  resolveFootprintCanvasLayout,
} from './ModuleDrawingSurfacePrimitives';

export type {
  FootprintCanvasLayout,
  FootprintCustomEdgeSpec,
  FootprintCustomVertexSpec,
  FootprintHandleSpec,
  FootprintResizeEdgeSpec,
} from './ModuleDrawingSurfacePrimitives';
