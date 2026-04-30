import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { WorkbenchHouseSelection, WorkbenchMode } from './compat/objectWorkbenchCompatibilityModel';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from './objectFirstWorkbenchModel';

export type DrawingWorkbenchViewportMode = 'sheet' | 'model' | 'geometry3d';

export type DrawingWorkbenchGeometrySelectionKind = WorkbenchHouseSelection['kind'];

export type DrawingWorkbenchSelectionState = {
  kind: 'none' | 'module' | 'geometry';
  targetId: string | null;
  targetKind?: DrawingWorkbenchGeometrySelectionKind;
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
  activeModuleIndex: number;
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

export type DrawingWorkbenchObjectSelectionState = Pick<
  DrawingWorkbenchUiState,
  'activeRailTab' | 'activeObjectFamily' | 'activeObjectRef'
>;

export type DrawingWorkbenchCompatibilitySelectionState = {
  workbenchMode: WorkbenchMode;
  activeHouseSelection: WorkbenchHouseSelection;
  activePergolaId: string | null;
};

export type DrawingWorkbenchUiStateLegacySelectionOverrides = Partial<DrawingWorkbenchCompatibilitySelectionState>;

export type DrawingWorkbenchUiStateOverrides = Partial<DrawingWorkbenchUiState> &
  DrawingWorkbenchUiStateLegacySelectionOverrides;

export type DrawingWorkbenchObjectSelectionInput = {
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectFamily?: WorkbenchObjectFamily | null | undefined;
  activeObjectRef?: WorkbenchObjectRef | null | undefined;
  activePergolaId?: string | null | undefined;
  bridgeHouseSelection?: WorkbenchHouseSelection | null | undefined;
};

export type DrawingWorkbenchBridgeTargetSelectionInput = {
  target: WorkbenchHouseSelection;
  defaultHouseFormId?: string | null | undefined;
};

function buildDefaultDrawingWorkbenchUiState(): DrawingWorkbenchUiState {
  return {
    activeModuleIndex: 0,
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
  };
}

function splitUiStateOverrides(overrides: DrawingWorkbenchUiStateOverrides): {
  uiOverrides: Partial<DrawingWorkbenchUiState>;
  compatibilityOverrides: DrawingWorkbenchUiStateLegacySelectionOverrides;
} {
  const {
    workbenchMode,
    activeHouseSelection,
    activePergolaId,
    ...uiOverrides
  } = overrides;
  return {
    uiOverrides,
    compatibilityOverrides: {
      workbenchMode,
      activeHouseSelection,
      activePergolaId,
    },
  };
}

function normalizeWorkbenchMode(value: WorkbenchMode | null | undefined): WorkbenchMode {
  return value === 'pergolas' ? 'pergolas' : 'house';
}

function normalizeActiveObjectFamily(value: WorkbenchObjectFamily | null | undefined): WorkbenchObjectFamily {
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
  value: DrawingWorkbenchRailTab | null | undefined,
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

function normalizeActivePergolaId(value: string | null | undefined, pergolaIds: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (!pergolaIds.length) return value;
  if (value && pergolaIds.includes(value)) return value;
  return pergolaIds[0] ?? null;
}

function normalizeCompatibilitySelection(
  input: DrawingWorkbenchUiStateLegacySelectionOverrides,
  options: { pergolaIds?: string[] } = {},
): DrawingWorkbenchCompatibilitySelectionState {
  return {
    workbenchMode: normalizeWorkbenchMode(input.workbenchMode),
    activeHouseSelection: normalizeActiveHouseSelection(input.activeHouseSelection),
    activePergolaId: normalizeActivePergolaId(input.activePergolaId, options.pergolaIds ?? []),
  };
}

function deriveWorkbenchModeFromObjectSelection(
  selection: Pick<DrawingWorkbenchObjectSelectionState, 'activeRailTab' | 'activeObjectFamily'>,
): WorkbenchMode {
  return selection.activeRailTab === 'pergolas' || selection.activeObjectFamily === 'pergolas'
    ? 'pergolas'
    : 'house';
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

function normalizeDrawingWorkbenchSelectionState(
  value: DrawingWorkbenchSelectionState | null | undefined,
): DrawingWorkbenchSelectionState {
  if (value?.kind === 'module') {
    return { kind: 'module', targetId: value.targetId ?? null };
  }
  if (value?.kind === 'geometry' && value.targetKind) {
    return {
      kind: 'geometry',
      targetId: value.targetId ?? null,
      targetKind: value.targetKind,
    };
  }
  return { kind: 'none', targetId: null };
}

function buildSelectionStateFromCompatibility(
  compatibility: DrawingWorkbenchCompatibilitySelectionState,
): DrawingWorkbenchSelectionState | null {
  if (compatibility.activeHouseSelection.kind === 'house') return null;
  return {
    kind: 'geometry',
    targetId: compatibility.activeHouseSelection.targetId,
    targetKind: compatibility.activeHouseSelection.kind,
  };
}

function deriveObjectSelectionFromCompatibility(
  compatibility: DrawingWorkbenchCompatibilitySelectionState,
): DrawingWorkbenchObjectSelectionState {
  if (compatibility.workbenchMode === 'pergolas') {
    return {
      activeRailTab: 'pergolas',
      activeObjectFamily: 'pergolas',
      activeObjectRef: {
        family: 'pergolas',
        objectId: compatibility.activePergolaId,
      },
    };
  }

  if (compatibility.activeHouseSelection.kind === 'deck') {
    return {
      activeRailTab: 'decks',
      activeObjectFamily: 'decks',
      activeObjectRef: {
        family: 'decks',
        objectId: compatibility.activeHouseSelection.targetId,
      },
    };
  }

  if (compatibility.activeHouseSelection.kind === 'opening') {
    return {
      activeRailTab: 'openings',
      activeObjectFamily: 'openings',
      activeObjectRef: {
        family: 'openings',
        objectId: compatibility.activeHouseSelection.targetId,
      },
    };
  }

  return {
    activeRailTab: 'house_forms',
    activeObjectFamily: 'house_forms',
    activeObjectRef: {
      family: 'house_forms',
      objectId: compatibility.activeHouseSelection.targetId,
    },
  };
}

function hasCompatibilitySelectionSignal(compatibility: DrawingWorkbenchCompatibilitySelectionState): boolean {
  return (
    compatibility.workbenchMode === 'pergolas' ||
    compatibility.activePergolaId !== null ||
    compatibility.activeHouseSelection.kind !== 'house'
  );
}

export function createDrawingWorkbenchUiState(
  overrides: DrawingWorkbenchUiStateOverrides = {},
): DrawingWorkbenchUiState {
  const { uiOverrides, compatibilityOverrides } = splitUiStateOverrides(overrides);
  const compatibility = normalizeCompatibilitySelection(compatibilityOverrides);
  const hasExplicitObjectSelection =
    uiOverrides.activeRailTab !== undefined ||
    uiOverrides.activeObjectFamily !== undefined ||
    uiOverrides.activeObjectRef !== undefined;
  const legacyObjectSelection =
    !hasExplicitObjectSelection && hasCompatibilitySelectionSignal(compatibility)
      ? deriveObjectSelectionFromCompatibility(compatibility)
      : {};
  const legacySelection = uiOverrides.selection ?? buildSelectionStateFromCompatibility(compatibility) ?? undefined;

  return {
    ...buildDefaultDrawingWorkbenchUiState(),
    ...legacyObjectSelection,
    ...uiOverrides,
    ...(legacySelection ? { selection: legacySelection } : {}),
  };
}

function normalizeObjectWorkbenchSelectionFamily(input: DrawingWorkbenchObjectSelectionInput): WorkbenchObjectFamily {
  if (input.activeRailTab === 'diagnostics') {
    return normalizeActiveObjectFamily(input.activeObjectFamily ?? input.activeObjectRef?.family ?? 'house_forms');
  }
  return normalizeActiveObjectFamily(input.activeRailTab);
}

export function buildDrawingWorkbenchObjectSelectionState(
  input: DrawingWorkbenchObjectSelectionInput,
): DrawingWorkbenchObjectSelectionState {
  const activeRailTab =
    input.activeRailTab === 'diagnostics'
      ? 'diagnostics'
      : normalizeActiveObjectFamily(input.activeRailTab);
  const activeObjectFamily = normalizeObjectWorkbenchSelectionFamily(input);
  const explicitObjectId =
    input.activeObjectRef?.family === activeObjectFamily ? input.activeObjectRef.objectId ?? null : null;
  const bridgeSelection = normalizeActiveHouseSelection(input.bridgeHouseSelection);
  const bridgeObjectId =
    activeObjectFamily === 'pergolas'
      ? input.activePergolaId ?? null
      : activeObjectFamily === 'decks' && bridgeSelection.kind === 'deck'
        ? bridgeSelection.targetId ?? null
        : activeObjectFamily === 'openings' && bridgeSelection.kind === 'opening'
          ? bridgeSelection.targetId ?? null
          : activeObjectFamily === 'house_forms' &&
              bridgeSelection.kind !== 'house' &&
              bridgeSelection.kind !== 'deck' &&
              bridgeSelection.kind !== 'opening'
            ? bridgeSelection.targetId ?? null
            : null;
  const objectId = explicitObjectId ?? bridgeObjectId;

  return {
    activeRailTab,
    activeObjectFamily,
    activeObjectRef: {
      family: activeObjectFamily,
      objectId,
    },
  };
}

function deriveRailTabFromBridgeTarget(target: WorkbenchHouseSelection): Exclude<DrawingWorkbenchRailTab, 'diagnostics'> {
  switch (target.kind) {
    case 'deck':
      return 'decks';
    case 'opening':
      return 'openings';
    default:
      return 'house_forms';
  }
}

export function buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget({
  target,
  defaultHouseFormId,
}: DrawingWorkbenchBridgeTargetSelectionInput): DrawingWorkbenchObjectSelectionState {
  const activeRailTab = deriveRailTabFromBridgeTarget(target);
  return buildDrawingWorkbenchObjectSelectionState({
    activeRailTab,
    activeObjectRef: {
      family: activeRailTab,
      objectId:
        activeRailTab === 'decks' || activeRailTab === 'openings'
          ? target.targetId ?? null
          : target.targetId ?? defaultHouseFormId ?? null,
    },
    bridgeHouseSelection: target,
  });
}

export function pickDrawingWorkbenchObjectSelectionState(
  state: DrawingWorkbenchUiState,
): DrawingWorkbenchObjectSelectionState {
  return {
    activeRailTab: state.activeRailTab,
    activeObjectFamily: state.activeObjectFamily,
    activeObjectRef: state.activeObjectRef,
  };
}

export function areDrawingWorkbenchObjectSelectionStatesEqual(
  first: DrawingWorkbenchObjectSelectionState,
  second: DrawingWorkbenchObjectSelectionState,
): boolean {
  return (
    first.activeRailTab === second.activeRailTab &&
    first.activeObjectFamily === second.activeObjectFamily &&
    first.activeObjectRef.family === second.activeObjectRef.family &&
    first.activeObjectRef.objectId === second.activeObjectRef.objectId
  );
}

export function areDrawingWorkbenchVisibilityStatesEqual(
  first: DrawingWorkbenchVisibilityState,
  second: DrawingWorkbenchVisibilityState,
): boolean {
  return (
    first.house === second.house &&
    first.pergolas === second.pergolas &&
    first.decks === second.decks &&
    first.openings === second.openings
  );
}

export function deriveDrawingWorkbenchCompatibilitySelection(
  state: DrawingWorkbenchUiState,
): DrawingWorkbenchCompatibilitySelectionState {
  const workbenchMode = deriveWorkbenchModeFromObjectSelection(state);
  const selection = normalizeDrawingWorkbenchSelectionState(state.selection);
  const activeHouseSelection: WorkbenchHouseSelection =
    state.activeObjectFamily === 'pergolas'
      ? { kind: 'house', targetId: null }
      : state.activeObjectFamily === 'decks'
        ? state.activeObjectRef.family === 'decks' && state.activeObjectRef.objectId
          ? { kind: 'deck', targetId: state.activeObjectRef.objectId }
          : { kind: 'house', targetId: null }
        : state.activeObjectFamily === 'openings'
          ? state.activeObjectRef.family === 'openings' && state.activeObjectRef.objectId
            ? { kind: 'opening', targetId: state.activeObjectRef.objectId }
            : { kind: 'house', targetId: null }
          : selection.kind === 'geometry' &&
              selection.targetKind &&
              selection.targetKind !== 'deck' &&
              selection.targetKind !== 'opening'
            ? { kind: selection.targetKind, targetId: selection.targetId }
            : { kind: 'house', targetId: null };

  return {
    workbenchMode,
    activeHouseSelection,
    activePergolaId:
      state.activeObjectFamily === 'pergolas' && state.activeObjectRef.family === 'pergolas'
        ? state.activeObjectRef.objectId
        : null,
  };
}

export function deriveDrawingWorkbenchCompatibilityState(
  input: DrawingWorkbenchObjectSelectionState & {
    activeHouseSelection?: WorkbenchHouseSelection | null;
    activePergolaId?: string | null;
    selection?: DrawingWorkbenchSelectionState | null;
  },
): DrawingWorkbenchCompatibilitySelectionState {
  const { activeHouseSelection, activePergolaId, selection, ...objectSelection } = input;
  const state = createDrawingWorkbenchUiState({
    ...objectSelection,
    selection:
      selection ??
      buildSelectionStateFromCompatibility({
        workbenchMode: deriveWorkbenchModeFromObjectSelection(input),
        activeHouseSelection: normalizeActiveHouseSelection(activeHouseSelection),
        activePergolaId: activePergolaId ?? null,
      }) ??
      undefined,
  });
  return deriveDrawingWorkbenchCompatibilitySelection(state);
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
  inputState: DrawingWorkbenchUiStateOverrides,
  input: {
    moduleCount: number;
    houseFormIds?: string[];
    pergolaIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
  },
): DrawingWorkbenchUiState {
  const { uiOverrides, compatibilityOverrides } = splitUiStateOverrides(inputState);
  const rawState: DrawingWorkbenchUiState = {
    ...buildDefaultDrawingWorkbenchUiState(),
    ...uiOverrides,
  };
  const legacyCompatibility = normalizeCompatibilitySelection(compatibilityOverrides, {
    pergolaIds: input.pergolaIds,
  });
  const legacyObjectSelection = hasCompatibilitySelectionSignal(legacyCompatibility)
    ? deriveObjectSelectionFromCompatibility(legacyCompatibility)
    : null;
  const activeObjectFamily = normalizeActiveObjectFamily(
    legacyObjectSelection?.activeObjectFamily ?? rawState.activeObjectFamily,
  );
  const requestedObjectRef = legacyObjectSelection?.activeObjectRef ?? rawState.activeObjectRef;
  const legacySelection = buildSelectionStateFromCompatibility(legacyCompatibility);
  const normalizedSelection = normalizeDrawingWorkbenchSelectionState(uiOverrides.selection ?? legacySelection);
  let bridgedObjectRef = requestedObjectRef;
  if (requestedObjectRef.family !== activeObjectFamily || !requestedObjectRef.objectId) {
    if (activeObjectFamily === 'decks' && normalizedSelection.kind === 'geometry' && normalizedSelection.targetKind === 'deck') {
      bridgedObjectRef = { family: 'decks', objectId: normalizedSelection.targetId ?? null };
    } else if (
      activeObjectFamily === 'openings' &&
      normalizedSelection.kind === 'geometry' &&
      normalizedSelection.targetKind === 'opening'
    ) {
      bridgedObjectRef = { family: 'openings', objectId: normalizedSelection.targetId ?? null };
    } else if (
      activeObjectFamily === 'house_forms' &&
      normalizedSelection.kind === 'geometry' &&
      normalizedSelection.targetKind !== 'deck' &&
      normalizedSelection.targetKind !== 'opening'
    ) {
      bridgedObjectRef = { family: 'house_forms', objectId: normalizedSelection.targetId ?? null };
    } else if (activeObjectFamily === 'decks' && legacyCompatibility.activeHouseSelection.kind === 'deck') {
      bridgedObjectRef = { family: 'decks', objectId: legacyCompatibility.activeHouseSelection.targetId ?? null };
    } else if (activeObjectFamily === 'openings' && legacyCompatibility.activeHouseSelection.kind === 'opening') {
      bridgedObjectRef = { family: 'openings', objectId: legacyCompatibility.activeHouseSelection.targetId ?? null };
    } else if (activeObjectFamily === 'pergolas' && legacyCompatibility.activePergolaId) {
      bridgedObjectRef = { family: 'pergolas', objectId: legacyCompatibility.activePergolaId };
    }
  }
  let activeObjectRef = normalizeActiveObjectRef(
    bridgedObjectRef.family === activeObjectFamily
      ? bridgedObjectRef
      : {
          family: activeObjectFamily,
          objectId: null,
    },
    input,
  );
  if (
    activeObjectFamily === 'pergolas' &&
    !activeObjectRef.objectId &&
    bridgedObjectRef.family === 'pergolas' &&
    Boolean(bridgedObjectRef.objectId) &&
    (input.pergolaIds ?? []).length
  ) {
    activeObjectRef = { family: 'pergolas', objectId: input.pergolaIds?.[0] ?? null };
  }
  const activeRailTab = normalizeActiveRailTab(
    legacyObjectSelection ? legacyObjectSelection.activeRailTab : rawState.activeRailTab,
    activeObjectFamily,
    legacyCompatibility.workbenchMode,
  );
  return {
    ...rawState,
    activeModuleIndex: clampDrawingWorkbenchModuleIndex(rawState.activeModuleIndex, input.moduleCount),
    activeRailTab,
    activeObjectFamily,
    activeObjectRef,
    selection: normalizedSelection,
    viewportTransform: clampDrawingWorkbenchViewportTransform(rawState.viewportTransform),
    visibility: normalizeDrawingWorkbenchVisibilityState(rawState.visibility),
  };
}
