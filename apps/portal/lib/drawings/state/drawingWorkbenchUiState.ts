import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';

export type DrawingWorkbenchViewportMode = 'sheet' | 'model';

export type DrawingWorkbenchUiState = {
  activeModuleIndex: number;
  activeView: ModuleViewsTab;
  viewportMode: DrawingWorkbenchViewportMode;
};

export function createDrawingWorkbenchUiState(
  overrides: Partial<DrawingWorkbenchUiState> = {},
): DrawingWorkbenchUiState {
  return {
    activeModuleIndex: 0,
    activeView: 'plan',
    viewportMode: 'sheet',
    ...overrides,
  };
}

export function clampDrawingWorkbenchModuleIndex(index: number, moduleCount: number): number {
  if (moduleCount <= 0) return 0;
  return Math.min(Math.max(index, 0), moduleCount - 1);
}
