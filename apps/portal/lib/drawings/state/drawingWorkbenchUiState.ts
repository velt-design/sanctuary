import type { ModuleViewsTab } from '@/app/(portal)/staff/calculator/ModuleViewsCard';
import type { WorkbenchHouseSelection, WorkbenchMode } from './houseFirstWorkbenchModel';

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
  workbenchMode: WorkbenchMode;
  activeModuleIndex: number;
  activeHouseSelection: WorkbenchHouseSelection;
  activePergolaId: string | null;
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
    workbenchMode: 'house',
    activeModuleIndex: 0,
    activeHouseSelection: { kind: 'house', targetId: null },
    activePergolaId: null,
    activeView: 'plan',
    viewportMode: 'sheet',
    selection: { kind: 'none', targetId: null },
    hover: { kind: 'none', targetId: null },
    drag: { kind: 'none', targetId: null },
    viewportTransform: { zoom: 1, panX: 0, panY: 0 },
    ...overrides,
  };
}

function normalizeWorkbenchMode(value: DrawingWorkbenchUiState['workbenchMode']): WorkbenchMode {
  return value === 'pergolas' ? 'pergolas' : 'house';
}

function normalizeActiveHouseSelection(value: WorkbenchHouseSelection | null | undefined): WorkbenchHouseSelection {
  switch (value?.kind) {
    case 'footprint':
    case 'roof':
    case 'deck':
    case 'opening':
    case 'attachment_zone':
      return {
        kind: value.kind,
        targetId: value.targetId ?? null,
      };
    case 'house':
    default:
      return { kind: 'house', targetId: null };
  }
}

function normalizeActivePergolaId(
  value: string | null | undefined,
  pergolaIds: string[],
): string | null {
  if (!pergolaIds.length) return null;
  if (value && pergolaIds.includes(value)) return value;
  return pergolaIds[0] ?? null;
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
  input: {
    moduleCount: number;
    pergolaIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
  },
): DrawingWorkbenchUiState {
  const workbenchMode = normalizeWorkbenchMode(state.workbenchMode);
  const activeHouseSelection = normalizeActiveHouseSelection(state.activeHouseSelection);
  const defaultHouseSelection: WorkbenchHouseSelection = { kind: 'house', targetId: null };
  const normalizedHouseSelection =
    activeHouseSelection.kind === 'deck' &&
    activeHouseSelection.targetId &&
    !(input.deckIds ?? []).includes(activeHouseSelection.targetId)
      ? defaultHouseSelection
      : activeHouseSelection.kind === 'opening' &&
          activeHouseSelection.targetId &&
          !(input.openingIds ?? []).includes(activeHouseSelection.targetId)
        ? defaultHouseSelection
        : activeHouseSelection;
  return {
    ...state,
    workbenchMode,
    activeModuleIndex: clampDrawingWorkbenchModuleIndex(state.activeModuleIndex, input.moduleCount),
    activeHouseSelection:
      workbenchMode === 'pergolas'
        ? defaultHouseSelection
        : normalizedHouseSelection,
    activePergolaId:
      workbenchMode === 'house'
        ? null
        : normalizeActivePergolaId(state.activePergolaId, input.pergolaIds ?? []),
    viewportTransform: clampDrawingWorkbenchViewportTransform(state.viewportTransform),
  };
}
