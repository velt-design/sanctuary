import type { WorkbenchPergolaRenderStatus } from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import type { ObjectFirstOpeningHostResolution } from './objectFirstDerivedHosting';
import type { HouseFirstMigrationWarning, HouseModel, PergolaModel } from './houseFirstWorkbenchModel';
import type { DrawingWorkbenchRailTab } from './drawingWorkbenchUiState';
import type { OpeningObjectModel, WorkbenchObjectFamily, WorkbenchObjectRef } from './objectFirstWorkbenchModel';

export type DrawingWorkbenchRailObjectStatus = 'ready' | 'approximate' | 'blocked' | 'deferred';

export type DrawingWorkbenchRailObjectEntry = {
  ref: WorkbenchObjectRef;
  label: string;
  status: DrawingWorkbenchRailObjectStatus;
  statusLabel: string;
  meta: string | null;
};

export type DrawingWorkbenchRailFamilySummary = {
  family: WorkbenchObjectFamily;
  label: string;
  singularLabel: string;
  count: number;
  countLabel: string;
  addActionLabels: string[];
  emptyTitle: string;
  emptyMessage: string;
};

export type DrawingWorkbenchRailInspectorContext = {
  family: WorkbenchObjectFamily;
  familyLabel: string;
  singularLabel: string;
  title: string;
  hasSelection: boolean;
  selectedObjectLabel: string | null;
  selectedObjectStatusLabel: string | null;
  selectedObjectMeta: string | null;
  emptyTitle: string;
  emptyMessage: string;
  addActionLabels: string[];
};

export type DrawingWorkbenchRailModel = {
  familySummaries: DrawingWorkbenchRailFamilySummary[];
  objectLists: Record<WorkbenchObjectFamily, DrawingWorkbenchRailObjectEntry[]>;
  selectedInspector: DrawingWorkbenchRailInspectorContext;
};

type DrawingWorkbenchRailPergolaModuleState = {
  pergolaId: string | null | undefined;
  planRenderStatus: WorkbenchPergolaRenderStatus;
};

const FAMILY_ORDER: WorkbenchObjectFamily[] = ['house_forms', 'decks', 'openings', 'pergolas'];

const FAMILY_DESCRIPTORS: Record<
  WorkbenchObjectFamily,
  Omit<DrawingWorkbenchRailFamilySummary, 'count' | 'countLabel'>
> = {
  house_forms: {
    family: 'house_forms',
    label: 'House Forms',
    singularLabel: 'House Form',
    addActionLabels: [],
    emptyTitle: 'No house form selected',
    emptyMessage:
      'Select the compatibility house form to edit footprint, roof, and attachment context in this slice.',
  },
  decks: {
    family: 'decks',
    label: 'Decks',
    singularLabel: 'Deck',
    addActionLabels: ['Add deck', 'Custom outline'],
    emptyTitle: 'No deck selected',
    emptyMessage: 'Select a deck to edit it, or add one to start defining external platforms.',
  },
  openings: {
    family: 'openings',
    label: 'Openings',
    singularLabel: 'Opening',
    addActionLabels: ['Add window', 'Add door', 'Add slider', 'Add stacker'],
    emptyTitle: 'No opening selected',
    emptyMessage: 'Select an opening to edit it, or add one to start defining derived-wall-hosted openings.',
  },
  pergolas: {
    family: 'pergolas',
    label: 'Pergolas',
    singularLabel: 'Pergola',
    addActionLabels: [],
    emptyTitle: 'No pergola selected',
    emptyMessage: 'Select a pergola to edit hosting, geometry, supports, and overrides.',
  },
};

function formatCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'object' : 'objects'}`;
}

function humanizePergolaFamily(family: PergolaModel['family']): string {
  switch (family) {
    case 'hip_corner':
      return 'Hip corner';
    case 'mono':
      return 'Mono';
    case 'gable':
      return 'Gable';
    case 'box':
      return 'Box';
    case 'hip':
      return 'Hip';
    default:
      return 'Unknown';
  }
}

function buildHouseFormEntries(
  house: HouseModel | null,
  warnings: HouseFirstMigrationWarning[],
): DrawingWorkbenchRailObjectEntry[] {
  if (!house) return [];
  return [
    {
      ref: {
        family: 'house_forms',
        objectId: house.id,
      },
      label: house.label,
      status: house.lowConfidence ? 'approximate' : 'ready',
      statusLabel: house.lowConfidence ? 'Approximate' : 'Ready',
      meta: `${house.footprint.preset} footprint | ${house.roof.form} roof | ${warnings.length} warning${
        warnings.length === 1 ? '' : 's'
      }`,
    },
  ];
}

function buildDeckEntries(house: HouseModel | null): DrawingWorkbenchRailObjectEntry[] {
  return (house?.decks ?? []).map((deck) => ({
    ref: {
      family: 'decks',
      objectId: deck.id,
    },
    label: deck.name,
    status: deck.validation.status === 'invalid' ? 'blocked' : 'ready',
    statusLabel: deck.validation.status === 'invalid' ? 'Invalid' : 'Ready',
    meta: `${deck.isAttached ? 'Attached' : 'Floating'} | ${
      deck.shape === 'preset' ? 'Preset rectangle' : 'Custom outline'
    }`,
  }));
}

function buildOpeningEntries(input: {
  openings: OpeningObjectModel[];
  compatibilityOpenings: HouseModel['openings'];
  hostResolutions: Record<string, ObjectFirstOpeningHostResolution>;
}): DrawingWorkbenchRailObjectEntry[] {
  const compatibilityById = new Map(input.compatibilityOpenings.map((opening) => [opening.id, opening]));
  return input.openings.map((opening) => {
    const compatibilityOpening = compatibilityById.get(opening.id) ?? null;
    const hostResolution = input.hostResolutions[opening.id] ?? null;
    const hostWallLabel =
      hostResolution?.status === 'resolved'
        ? hostResolution.wall?.label ?? 'Resolved derived wall'
        : 'Unresolved host wall';
    const invalid = compatibilityOpening?.validation.status === 'invalid';
    const unresolved = hostResolution?.status === 'unresolved';
    return {
      ref: {
        family: 'openings',
        objectId: opening.id,
      },
      label: opening.label,
      status: invalid || unresolved ? 'blocked' : 'ready',
      statusLabel: unresolved ? 'Unresolved host' : invalid ? 'Invalid' : 'Ready',
      meta: `${opening.kind.replace('_', ' ')} | ${hostWallLabel}`,
    };
  });
}

function resolvePergolaEntryStatus(input: {
  pergola: PergolaModel;
  moduleStates: DrawingWorkbenchRailPergolaModuleState[];
}): Pick<DrawingWorkbenchRailObjectEntry, 'status' | 'statusLabel'> {
  if (input.pergola.attachment.kind !== 'freestanding' && input.pergola.attachment.resolution.status === 'ambiguous') {
    return {
      status: 'blocked',
      statusLabel: 'Ambiguous host',
    };
  }
  if (input.pergola.attachment.kind !== 'freestanding' && input.pergola.attachment.resolution.status === 'unresolved') {
    return {
      status: 'blocked',
      statusLabel: 'Unresolved host',
    };
  }
  if (input.moduleStates.some((module) => module.planRenderStatus === 'legacy_unsupported_family')) {
    return {
      status: 'deferred',
      statusLabel: 'View only',
    };
  }
  if (input.moduleStates.some((module) => module.planRenderStatus === 'invalid_geometry')) {
    return {
      status: 'blocked',
      statusLabel: 'Invalid geometry',
    };
  }
  if (input.pergola.confidence === 'low') {
    return {
      status: 'approximate',
      statusLabel: 'Approximate',
    };
  }
  return {
    status: 'ready',
    statusLabel: 'Ready',
  };
}

function buildPergolaEntries(input: {
  house: HouseModel | null;
  pergolas: PergolaModel[];
  modules: DrawingWorkbenchRailPergolaModuleState[];
}): DrawingWorkbenchRailObjectEntry[] {
  const pergolasById = new Map<string, PergolaModel>();
  for (const pergola of input.pergolas) {
    if (!pergolasById.has(pergola.id)) {
      pergolasById.set(pergola.id, pergola);
    }
  }

  return Array.from(pergolasById.values()).map((pergola) => {
    const moduleStates = input.modules.filter((module) => module.pergolaId === pergola.id);
    const status = resolvePergolaEntryStatus({
      pergola,
      moduleStates,
    });
    const edgeLabel = pergola.attachment.attachmentEdgeId
      ? input.house?.derivedEnvelope?.edges.find((edge) => edge.id === pergola.attachment.attachmentEdgeId)?.label ??
        'Unavailable saved edge'
      : pergola.attachment.kind === 'freestanding'
        ? 'Freestanding'
        : 'No host edge';
    const zoneLabel = pergola.attachment.attachmentZoneId
      ? input.house?.derivedEnvelope?.attachmentZones.find((zone) => zone.id === pergola.attachment.attachmentZoneId)?.label ??
        'Unavailable saved zone'
      : pergola.attachment.kind === 'freestanding'
        ? null
        : 'No host zone';
    return {
      ref: {
        family: 'pergolas',
        objectId: pergola.id,
      },
      label: pergola.label,
      status: status.status,
      statusLabel: status.statusLabel,
      meta: `${humanizePergolaFamily(pergola.family)} | ${edgeLabel}${zoneLabel ? ` | ${zoneLabel}` : ''}`,
    };
  });
}

function buildFamilySummary(
  family: WorkbenchObjectFamily,
  objectLists: Record<WorkbenchObjectFamily, DrawingWorkbenchRailObjectEntry[]>,
): DrawingWorkbenchRailFamilySummary {
  const descriptor = FAMILY_DESCRIPTORS[family];
  const count = objectLists[family].length;
  return {
    ...descriptor,
    count,
    countLabel: formatCountLabel(count),
  };
}

function resolveActiveFamily(
  activeRailTab: DrawingWorkbenchRailTab,
  activeObjectFamily: WorkbenchObjectFamily,
): WorkbenchObjectFamily {
  return activeRailTab === 'diagnostics' ? activeObjectFamily : activeRailTab;
}

export function buildDrawingWorkbenchRailModel(input: {
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectFamily: WorkbenchObjectFamily;
  activeObjectRef: WorkbenchObjectRef;
  house: HouseModel | null;
  openings: OpeningObjectModel[];
  openingHostResolutions: Record<string, ObjectFirstOpeningHostResolution>;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
  modules: DrawingWorkbenchRailPergolaModuleState[];
}): DrawingWorkbenchRailModel {
  const objectLists: Record<WorkbenchObjectFamily, DrawingWorkbenchRailObjectEntry[]> = {
    house_forms: buildHouseFormEntries(input.house, input.warnings),
    decks: buildDeckEntries(input.house),
    openings: buildOpeningEntries({
      openings: input.openings,
      compatibilityOpenings: input.house?.openings ?? [],
      hostResolutions: input.openingHostResolutions,
    }),
    pergolas: buildPergolaEntries({
      house: input.house,
      pergolas: input.pergolas,
      modules: input.modules,
    }),
  };
  const familySummaries = FAMILY_ORDER.map((family) => buildFamilySummary(family, objectLists));
  const selectedFamily = resolveActiveFamily(input.activeRailTab, input.activeObjectFamily);
  const selectedDescriptor = FAMILY_DESCRIPTORS[selectedFamily];
  const selectedEntry =
    objectLists[selectedFamily].find((entry) => entry.ref.objectId === input.activeObjectRef.objectId) ?? null;

  return {
    familySummaries,
    objectLists,
    selectedInspector: {
      family: selectedFamily,
      familyLabel: selectedDescriptor.label,
      singularLabel: selectedDescriptor.singularLabel,
      title: `${selectedDescriptor.singularLabel} Inspector`,
      hasSelection: selectedEntry !== null,
      selectedObjectLabel: selectedEntry?.label ?? null,
      selectedObjectStatusLabel: selectedEntry?.statusLabel ?? null,
      selectedObjectMeta: selectedEntry?.meta ?? null,
      emptyTitle: selectedDescriptor.emptyTitle,
      emptyMessage: selectedDescriptor.emptyMessage,
      addActionLabels: selectedDescriptor.addActionLabels,
    },
  };
}
