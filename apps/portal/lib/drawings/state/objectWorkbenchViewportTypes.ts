import type { DrawingWorkbenchGeometrySelectionKind } from './drawingWorkbenchUiState';
import type { ObjectWorkbenchDeckPatch, ObjectWorkbenchOpeningPatch } from './objectWorkbenchInspectorModel';

export type ObjectWorkbenchDisplayFamily = 'house_forms' | 'pergolas';

export type ObjectWorkbenchViewportTargetSelection = {
  kind: DrawingWorkbenchGeometrySelectionKind;
  targetId: string | null;
};

export type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
};
