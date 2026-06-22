import type { DrawingWorkbenchGeometrySelectionKind } from './drawingWorkbenchUiState';

export type ObjectWorkbenchDisplayFamily = 'house_forms' | 'pergolas';

export type ObjectWorkbenchViewportTargetSelection = {
  kind: DrawingWorkbenchGeometrySelectionKind;
  targetId: string | null;
};
