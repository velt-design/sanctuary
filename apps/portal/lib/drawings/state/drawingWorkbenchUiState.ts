import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';

export type DrawingWorkbenchViewportMode = 'sheet' | 'model' | 'geometry3d';

export type DrawingWorkbenchSelectionState = {
  kind: 'none' | 'module' | 'geometry';
  targetId: string | null;
};

export type DrawingWorkbenchHoverState = {
  kind: 'none' | 'house_fill' | 'house_edge' | 'house_popover' | 'pergola' | 'pergola_popover';
  targetId: string | null;
};

export type DrawingWorkbenchDragState = {
  kind: 'none' | 'house_edge';
  targetId: string | null;
};

export type DrawingWorkbenchViewportTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export type DrawingWorkbenchUiState = {
  activeModuleIndex: number;
  activeView: ModuleViewsTab;
  viewportMode: DrawingWorkbenchViewportMode;
  selection: DrawingWorkbenchSelectionState;
  hover: DrawingWorkbenchHoverState;
  drag: DrawingWorkbenchDragState;
  viewportTransform: DrawingWorkbenchViewportTransform;
};

export function createDrawingWorkbenchUiState(
  overrides: Partial<DrawingWorkbenchUiState> = {},
): DrawingWorkbenchUiState {
  return {
    activeModuleIndex: 0,
    activeView: 'plan',
    viewportMode: 'sheet',
    selection: { kind: 'none', targetId: null },
    hover: { kind: 'none', targetId: null },
    drag: { kind: 'none', targetId: null },
    viewportTransform: { zoom: 1, panX: 0, panY: 0 },
    ...overrides,
  };
}

export function clampDrawingWorkbenchModuleIndex(index: number, moduleCount: number): number {
  if (moduleCount <= 0) return 0;
  return Math.min(Math.max(index, 0), moduleCount - 1);
}

export function clampDrawingWorkbenchViewportTransform(
  transform: DrawingWorkbenchViewportTransform,
): DrawingWorkbenchViewportTransform {
  return {
    zoom: Math.min(Math.max(transform.zoom, 0.25), 6),
    panX: Number.isFinite(transform.panX) ? transform.panX : 0,
    panY: Number.isFinite(transform.panY) ? transform.panY : 0,
  };
}

export function normalizeDrawingWorkbenchUiState(
  state: DrawingWorkbenchUiState,
  moduleCount: number,
): DrawingWorkbenchUiState {
  return {
    ...state,
    activeModuleIndex: clampDrawingWorkbenchModuleIndex(state.activeModuleIndex, moduleCount),
    viewportTransform: clampDrawingWorkbenchViewportTransform(state.viewportTransform),
  };
}
