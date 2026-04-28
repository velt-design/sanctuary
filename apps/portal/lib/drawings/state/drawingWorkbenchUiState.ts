import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { WorkbenchHouseSelection, WorkbenchMode } from './houseFirstWorkbenchModel';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from './objectFirstWorkbenchModel';

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

export type DrawingWorkbenchVisibilityState = {
  house: boolean;
  pergolas: boolean;
  decks: boolean;
  openings: boolean;
};

export type DrawingWorkbenchRailTab = WorkbenchObjectFamily | 'diagnostics';

export type DrawingWorkbenchUiState = {
  workbenchMode: WorkbenchMode;
  activeModuleIndex: number;
  activeHouseSelection: WorkbenchHouseSelection;
  activePergolaId: string | null;
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectFamily: WorkbenchObjectFamily;
  activeObjectRef: WorkbenchObjectRef;
  activeView: ModuleViewsTab;
  viewportMode: DrawingWorkbenchViewportMode;
  selection: DrawingWorkbenchSelectionState;
  hover: DrawingWorkbenchHoverState;
  drag: DrawingWorkbenchDragState;
  viewportTransform: DrawingWorkbenchViewportTransform;
  visibility: DrawingWorkbenchVisibilityState;
};

export function createDrawingWorkbenchUiState(
  overrides: Partial<DrawingWorkbenchUiState> = {},
): DrawingWorkbenchUiState {
  return {
    workbenchMode: 'house',
    activeModuleIndex: 0,
    activeHouseSelection: { kind: 'house', targetId: null },
    activePergolaId: null,
    activeRailTab: 'house_forms',
    activeObjectFamily: 'house_forms',
    activeObjectRef: { family: 'house_forms', objectId: null },
    activeView: 'plan',
    viewportMode: 'sheet',
    selection: { kind: 'none', targetId: null },
    hover: { kind: 'none', targetId: null },
    drag: { kind: 'none', targetId: null },
    viewportTransform: { zoom: 1, panX: 0, panY: 0 },
    visibility: {
      house: true,
      pergolas: true,
      decks: true,
      openings: true,
    },
    ...overrides,
  };
}

function normalizeWorkbenchMode(value: DrawingWorkbenchUiState['workbenchMode']): WorkbenchMode {
  return value === 'pergolas' ? 'pergolas' : 'house';
}

function normalizeActiveObjectFamily(
  value: DrawingWorkbenchUiState['activeObjectFamily'],
): WorkbenchObjectFamily {
  switch (value) {
    case 'decks':
    case 'openings':
    case 'pergolas':
      return value;
    case 'house_forms':
    default:
      return 'house_forms';
  }
}

function normalizeActiveRailTab(
  value: DrawingWorkbenchUiState['activeRailTab'] | null | undefined,
  fallbackFamily: WorkbenchObjectFamily,
  workbenchMode: WorkbenchMode,
): DrawingWorkbenchRailTab {
  switch (value) {
    case 'diagnostics':
    case 'decks':
    case 'openings':
    case 'pergolas':
    case 'house_forms':
      return value;
    default:
      return workbenchMode === 'pergolas' ? 'pergolas' : fallbackFamily;
  }
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

function getObjectIdsForFamily(
  family: WorkbenchObjectFamily,
  input: {
    houseFormIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
    pergolaIds?: string[];
  },
): string[] {
  switch (family) {
    case 'decks':
      return input.deckIds ?? [];
    case 'openings':
      return input.openingIds ?? [];
    case 'pergolas':
      return input.pergolaIds ?? [];
    case 'house_forms':
    default:
      return input.houseFormIds ?? [];
  }
}

function normalizeActiveObjectRef(
  value: WorkbenchObjectRef | null | undefined,
  input: {
    houseFormIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
    pergolaIds?: string[];
  },
): WorkbenchObjectRef {
  const family = normalizeActiveObjectFamily(value?.family ?? 'house_forms');
  const objectId = value?.objectId ?? null;
  return {
    family,
    objectId: objectId && getObjectIdsForFamily(family, input).includes(objectId) ? objectId : null,
  };
}

function deriveCanonicalSelectionFromLegacy(
  state: DrawingWorkbenchUiState,
): {
  activeObjectFamily: WorkbenchObjectFamily;
  activeObjectRef: WorkbenchObjectRef;
} {
  if (state.workbenchMode === 'pergolas') {
    return {
      activeObjectFamily: 'pergolas',
      activeObjectRef: {
        family: 'pergolas',
        objectId: state.activePergolaId ?? null,
      },
    };
  }

  switch (state.activeHouseSelection.kind) {
    case 'deck':
      return {
        activeObjectFamily: 'decks',
        activeObjectRef: {
          family: 'decks',
          objectId: state.activeHouseSelection.targetId ?? null,
        },
      };
    case 'opening':
      return {
        activeObjectFamily: 'openings',
        activeObjectRef: {
          family: 'openings',
          objectId: state.activeHouseSelection.targetId ?? null,
        },
      };
    default:
      return {
        activeObjectFamily: 'house_forms',
        activeObjectRef: {
          family: 'house_forms',
          objectId: null,
        },
      };
  }
}

function shouldDeriveCanonicalSelectionFromLegacy(state: DrawingWorkbenchUiState): boolean {
  return (
    state.activeObjectFamily === 'house_forms' &&
    state.activeObjectRef.family === 'house_forms' &&
    state.activeObjectRef.objectId === null &&
    (state.workbenchMode === 'pergolas' ||
      state.activeHouseSelection.kind === 'deck' ||
      state.activeHouseSelection.kind === 'opening')
  );
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

export function normalizeDrawingWorkbenchVisibilityState(
  visibility: Partial<DrawingWorkbenchVisibilityState> | null | undefined,
): DrawingWorkbenchVisibilityState {
  return {
    house: visibility?.house !== false,
    pergolas: visibility?.pergolas !== false,
    decks: visibility?.decks !== false,
    openings: visibility?.openings !== false,
  };
}

export function normalizeDrawingWorkbenchUiState(
  state: DrawingWorkbenchUiState,
  input: {
    moduleCount: number;
    houseFormIds?: string[];
    pergolaIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
  },
): DrawingWorkbenchUiState {
  const workbenchMode = normalizeWorkbenchMode(state.workbenchMode);
  const activeHouseSelection = normalizeActiveHouseSelection(state.activeHouseSelection);
  const normalizedPergolaId =
    workbenchMode === 'house'
      ? null
      : normalizeActivePergolaId(state.activePergolaId, input.pergolaIds ?? []);
  const canonicalSelection = shouldDeriveCanonicalSelectionFromLegacy(state)
    ? deriveCanonicalSelectionFromLegacy({
        ...state,
        workbenchMode,
        activeHouseSelection,
        activePergolaId: normalizedPergolaId,
      })
    : null;
  const activeObjectFamily = normalizeActiveObjectFamily(
    canonicalSelection?.activeObjectFamily ?? state.activeObjectFamily,
  );
  const activeObjectRef = normalizeActiveObjectRef(
    canonicalSelection?.activeObjectRef ?? state.activeObjectRef,
    input,
  );
  const activeRailTab = normalizeActiveRailTab(
    canonicalSelection ? canonicalSelection.activeObjectFamily : state.activeRailTab,
    activeObjectFamily,
    workbenchMode,
  );
  const normalizedHouseSelection: WorkbenchHouseSelection =
    activeHouseSelection.kind === 'deck' &&
    activeHouseSelection.targetId &&
    !(input.deckIds ?? []).includes(activeHouseSelection.targetId)
      ? { kind: 'house', targetId: null }
      : activeHouseSelection.kind === 'opening' &&
          activeHouseSelection.targetId &&
          !(input.openingIds ?? []).includes(activeHouseSelection.targetId)
        ? { kind: 'house', targetId: null }
        : activeHouseSelection;
  return {
    ...state,
    workbenchMode,
    activeModuleIndex: clampDrawingWorkbenchModuleIndex(state.activeModuleIndex, input.moduleCount),
    activeHouseSelection:
      workbenchMode === 'pergolas'
        ? { kind: 'house', targetId: null }
        : normalizedHouseSelection,
    activePergolaId:
      normalizedPergolaId,
    activeRailTab,
    activeObjectFamily,
    activeObjectRef,
    viewportTransform: clampDrawingWorkbenchViewportTransform(state.viewportTransform),
    visibility: normalizeDrawingWorkbenchVisibilityState(state.visibility),
  };
}
