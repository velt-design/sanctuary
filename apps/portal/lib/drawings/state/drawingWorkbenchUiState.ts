import type { WorkbenchObjectFamily, WorkbenchObjectRef } from './objectFirstWorkbenchModel';

export type DrawingWorkbenchViewportMode = 'sheet' | 'plan' | 'geometry3d';

export type DrawingWorkbenchGeometrySelectionKind =
  | 'house'
  | 'footprint'
  | 'roof'
  | 'deck'
  | 'opening'
  | 'attachment_zone';

type DrawingWorkbenchSelectionState = {
  kind: 'none' | 'pergola' | 'geometry';
  targetId: string | null;
  targetKind?: DrawingWorkbenchGeometrySelectionKind;
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

export type DrawingWorkbenchUiState = {
  activePergolaId: string | null;
  activeObjectRef: WorkbenchObjectRef;
  viewportMode: DrawingWorkbenchViewportMode;
  selection: DrawingWorkbenchSelectionState;
  viewportTransform: DrawingWorkbenchViewportTransform;
  visibility: DrawingWorkbenchVisibilityState;
};

type DrawingWorkbenchObjectSelectionState = Pick<
  DrawingWorkbenchUiState,
  'activeObjectRef'
>;

type DrawingWorkbenchUiStateOverrides = Omit<
  Partial<DrawingWorkbenchUiState>,
  'viewportMode'
> & {
  viewportMode?: DrawingWorkbenchViewportMode | string | null | undefined;
  [key: string]: unknown;
};

type DrawingWorkbenchRuntimeUiStateOverrides = Omit<
  Partial<DrawingWorkbenchUiState>,
  'viewportMode'
> & {
  viewportMode?: DrawingWorkbenchViewportMode | string | null | undefined;
};

type DrawingWorkbenchObjectSelectionInput = {
  activeObjectRef: WorkbenchObjectRef;
};

function buildDefaultDrawingWorkbenchUiState(): DrawingWorkbenchUiState {
  return {
    activePergolaId: null,
    activeObjectRef: { family: 'house_forms', objectId: null },
    viewportMode: 'sheet',
    selection: { kind: 'none', targetId: null },
    viewportTransform: { zoom: 1, panX: 0, panY: 0 },
    visibility: {
      house: true,
      pergolas: true,
      decks: true,
      openings: true,
    },
  };
}

function pickLiveDrawingWorkbenchUiOverrides(
  overrides: DrawingWorkbenchUiStateOverrides,
): DrawingWorkbenchRuntimeUiStateOverrides {
  const {
    activePergolaId,
    activeObjectRef,
    viewportMode,
    selection,
    viewportTransform,
    visibility,
  } = overrides;
  return {
    ...(activePergolaId !== undefined ? { activePergolaId } : {}),
    ...(activeObjectRef !== undefined ? { activeObjectRef } : {}),
    ...(viewportMode !== undefined ? { viewportMode } : {}),
    ...(selection !== undefined ? { selection } : {}),
    ...(viewportTransform !== undefined ? { viewportTransform } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
  };
}

function normalizeObjectFamily(value: WorkbenchObjectFamily | null | undefined): WorkbenchObjectFamily {
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

function normalizeViewportMode(
  value: DrawingWorkbenchViewportMode | string | null | undefined,
): DrawingWorkbenchViewportMode | null {
  switch (value) {
    case 'sheet':
    case 'plan':
    case 'geometry3d':
      return value;
    default:
      return null;
  }
}

function normalizeActivePergolaId(value: string | null | undefined, pergolaIds: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (!pergolaIds.length) return value;
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
  const family = normalizeObjectFamily(value?.family ?? 'house_forms');
  const objectId = value?.objectId ?? null;
  return {
    family,
    objectId: objectId && getObjectIdsForFamily(family, input).includes(objectId) ? objectId : null,
  };
}

function normalizeDrawingWorkbenchSelectionState(
  value: DrawingWorkbenchSelectionState | null | undefined,
): DrawingWorkbenchSelectionState {
  if (value?.kind === 'pergola') {
    return { kind: 'pergola', targetId: value.targetId ?? null };
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

export function createDrawingWorkbenchUiState(
  overrides: DrawingWorkbenchUiStateOverrides = {},
): DrawingWorkbenchUiState {
  const uiOverrides = pickLiveDrawingWorkbenchUiOverrides(overrides);
  const {
    viewportMode: overrideViewportMode,
    ...restUiOverrides
  } = uiOverrides;
  const normalizedViewportMode = normalizeViewportMode(overrideViewportMode);
  const normalizedUiOverrides: Partial<DrawingWorkbenchUiState> = {
    ...restUiOverrides,
    ...(normalizedViewportMode ? { viewportMode: normalizedViewportMode } : {}),
  };

  return {
    ...buildDefaultDrawingWorkbenchUiState(),
    ...normalizedUiOverrides,
  };
}

export function buildDrawingWorkbenchObjectSelectionState(
  input: DrawingWorkbenchObjectSelectionInput,
): DrawingWorkbenchObjectSelectionState {
  const objectFamily = normalizeObjectFamily(input.activeObjectRef.family);

  return {
    activeObjectRef: {
      family: objectFamily,
      objectId: input.activeObjectRef.objectId ?? null,
    },
  };
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

function clampDrawingWorkbenchViewportTransform(
  transform: DrawingWorkbenchViewportTransform,
): DrawingWorkbenchViewportTransform {
  return {
    zoom: Math.min(Math.max(transform.zoom, 0.25), 6),
    panX: Number.isFinite(transform.panX) ? transform.panX : 0,
    panY: Number.isFinite(transform.panY) ? transform.panY : 0,
  };
}

function normalizeDrawingWorkbenchVisibilityState(
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
    houseFormIds?: string[];
    pergolaIds?: string[];
    deckIds?: string[];
    openingIds?: string[];
  },
): DrawingWorkbenchUiState {
  const uiOverrides = pickLiveDrawingWorkbenchUiOverrides(inputState);
  const {
    viewportMode: overrideViewportMode,
    ...restUiOverrides
  } = uiOverrides;
  const normalizedRawViewportMode = normalizeViewportMode(overrideViewportMode);
  const rawState: DrawingWorkbenchUiState = {
    ...buildDefaultDrawingWorkbenchUiState(),
    ...restUiOverrides,
    ...(normalizedRawViewportMode ? { viewportMode: normalizedRawViewportMode } : {}),
  };
  const objectFamily = normalizeObjectFamily(rawState.activeObjectRef.family);
  const requestedObjectRef = rawState.activeObjectRef;
  const requestedActivePergolaId =
    rawState.activePergolaId ??
    (requestedObjectRef.family === 'pergolas' ? requestedObjectRef.objectId : null);
  const normalizedSelection = normalizeDrawingWorkbenchSelectionState(uiOverrides.selection);
  let bridgedObjectRef = requestedObjectRef;
  if (requestedObjectRef.family !== objectFamily || !requestedObjectRef.objectId) {
    if (objectFamily === 'decks' && normalizedSelection.kind === 'geometry' && normalizedSelection.targetKind === 'deck') {
      bridgedObjectRef = { family: 'decks', objectId: normalizedSelection.targetId ?? null };
    } else if (
      objectFamily === 'openings' &&
      normalizedSelection.kind === 'geometry' &&
      normalizedSelection.targetKind === 'opening'
    ) {
      bridgedObjectRef = { family: 'openings', objectId: normalizedSelection.targetId ?? null };
    } else if (
      objectFamily === 'house_forms' &&
      normalizedSelection.kind === 'geometry' &&
      normalizedSelection.targetKind !== 'deck' &&
      normalizedSelection.targetKind !== 'opening'
    ) {
      bridgedObjectRef = { family: 'house_forms', objectId: normalizedSelection.targetId ?? null };
    } else if (objectFamily === 'pergolas' && requestedActivePergolaId) {
      bridgedObjectRef = { family: 'pergolas', objectId: requestedActivePergolaId };
    }
  }
  let activeObjectRef = normalizeActiveObjectRef(
    bridgedObjectRef.family === objectFamily
      ? bridgedObjectRef
      : {
          family: objectFamily,
          objectId: null,
    },
    input,
  );
  if (
    objectFamily === 'pergolas' &&
    !activeObjectRef.objectId &&
    bridgedObjectRef.family === 'pergolas' &&
    Boolean(bridgedObjectRef.objectId) &&
    (input.pergolaIds ?? []).length
  ) {
    activeObjectRef = { family: 'pergolas', objectId: input.pergolaIds?.[0] ?? null };
  }
  const activePergolaId = normalizeActivePergolaId(
    objectFamily === 'pergolas' && activeObjectRef.family === 'pergolas' && activeObjectRef.objectId
      ? activeObjectRef.objectId
      : requestedActivePergolaId,
    input.pergolaIds ?? [],
  );
  return {
    ...rawState,
    activePergolaId,
    activeObjectRef,
    selection: normalizedSelection,
    viewportTransform: clampDrawingWorkbenchViewportTransform(rawState.viewportTransform),
    visibility: normalizeDrawingWorkbenchVisibilityState(rawState.visibility),
  };
}
