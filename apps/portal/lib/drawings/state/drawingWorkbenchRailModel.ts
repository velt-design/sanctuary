import type { ObjectWorkbenchPergolaRenderStatus } from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import type {
  ObjectFirstOpeningHostResolution,
  ObjectFirstPergolaAttachmentResolution,
} from './objectFirstDerivedHosting';
import type { DrawingWorkbenchRailTab } from './drawingWorkbenchUiState';
import type {
  DeckObjectModel,
  HouseFormModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchObjectFamily,
  WorkbenchObjectRef,
} from './objectFirstWorkbenchModel';
import type { ObjectWorkbenchStatusFacade } from './objectWorkbenchStatusModel';

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
  planRenderStatus: ObjectWorkbenchPergolaRenderStatus;
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

function humanizePergolaFamily(family: PergolaObjectModel['family']): string {
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
  houseForms: HouseFormModel[],
  status: ObjectWorkbenchStatusFacade,
): DrawingWorkbenchRailObjectEntry[] {
  return houseForms.map((houseForm) => {
    const warningCount = status.houseForm.warnings.length;
    return {
      ref: {
        family: 'house_forms',
        objectId: houseForm.id,
      },
      label: houseForm.label,
      status: status.houseForm.lowConfidence ? 'approximate' : 'ready',
      statusLabel: status.houseForm.lowConfidence ? 'Approximate' : 'Ready',
      meta: `${status.houseForm.footprintPreset ?? houseForm.footprint.preset} footprint | ${
        status.houseForm.roofForm ?? houseForm.roofIntent.form
      } roof | ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
    };
  });
}

function buildDeckEntries(input: {
  decks: DeckObjectModel[];
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailObjectEntry[] {
  return input.decks.map((deck) => {
    const deckStatus = input.status.deckStatuses[deck.id] ?? null;
    const invalid = deckStatus?.validation.status === 'invalid';
    return {
      ref: {
        family: 'decks',
        objectId: deck.id,
      },
      label: deck.label,
      status: invalid ? 'blocked' : 'ready',
      statusLabel: invalid ? 'Invalid' : 'Ready',
      meta: `${deck.isAttached ? 'Attached' : 'Floating'} | ${
        deck.shape === 'preset' ? 'Preset rectangle' : 'Custom outline'
      }`,
    };
  });
}

function buildOpeningEntries(input: {
  openings: OpeningObjectModel[];
  hostResolutions: Record<string, ObjectFirstOpeningHostResolution>;
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailObjectEntry[] {
  return input.openings.map((opening) => {
    const openingStatus = input.status.openingStatuses[opening.id] ?? null;
    const hostResolution = input.hostResolutions[opening.id] ?? null;
    const hostWallLabel =
      hostResolution?.status === 'resolved'
        ? hostResolution.wall?.label ?? 'Resolved derived wall'
        : 'Unresolved host wall';
    const invalid = openingStatus?.validation.status === 'invalid';
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
  pergola: PergolaObjectModel;
  attachmentResolution: ObjectFirstPergolaAttachmentResolution | null;
  moduleStates: DrawingWorkbenchRailPergolaModuleState[];
  status: ObjectWorkbenchStatusFacade;
}): Pick<DrawingWorkbenchRailObjectEntry, 'status' | 'statusLabel'> {
  const pergolaStatus = input.status.pergolaStatuses[input.pergola.id] ?? null;
  const isFreestanding = pergolaStatus?.isFreestanding;
  if (!isFreestanding && input.attachmentResolution?.status === 'unresolved') {
    return {
      status: 'blocked',
      statusLabel: 'Unresolved attachment',
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
  if (pergolaStatus?.confidence === 'low') {
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
  pergolas: PergolaObjectModel[];
  attachmentResolutions: Record<string, ObjectFirstPergolaAttachmentResolution>;
  modules: DrawingWorkbenchRailPergolaModuleState[];
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailObjectEntry[] {
  return input.pergolas.map((pergola) => {
    const pergolaStatus = input.status.pergolaStatuses[pergola.id] ?? null;
    const attachmentResolution = input.attachmentResolutions[pergola.id] ?? null;
    const moduleStates = input.modules.filter((module) => module.pergolaId === pergola.id);
    const entryStatus = resolvePergolaEntryStatus({
      pergola,
      attachmentResolution,
      moduleStates,
      status: input.status,
    });
    const edgeLabel = attachmentResolution?.edge
      ? attachmentResolution.edge.label
      : pergolaStatus?.isFreestanding
        ? 'Freestanding'
        : 'Unresolved host edge';
    const zoneLabel = attachmentResolution?.zone
      ? attachmentResolution.zone.label
      : pergolaStatus?.isFreestanding
        ? null
        : pergola.attachmentZoneId
          ? 'Unresolved host zone'
          : null;
    return {
      ref: {
        family: 'pergolas',
        objectId: pergola.id,
      },
      label: pergola.label,
      status: entryStatus.status,
      statusLabel: entryStatus.statusLabel,
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
  houseForms: HouseFormModel[];
  decks: DeckObjectModel[];
  openings: OpeningObjectModel[];
  openingHostResolutions: Record<string, ObjectFirstOpeningHostResolution>;
  pergolas: PergolaObjectModel[];
  pergolaAttachmentResolutions: Record<string, ObjectFirstPergolaAttachmentResolution>;
  modules: DrawingWorkbenchRailPergolaModuleState[];
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailModel {
  const objectLists: Record<WorkbenchObjectFamily, DrawingWorkbenchRailObjectEntry[]> = {
    house_forms: buildHouseFormEntries(input.houseForms, input.status),
    decks: buildDeckEntries({
      decks: input.decks,
      status: input.status,
    }),
    openings: buildOpeningEntries({
      openings: input.openings,
      hostResolutions: input.openingHostResolutions,
      status: input.status,
    }),
    pergolas: buildPergolaEntries({
      pergolas: input.pergolas,
      attachmentResolutions: input.pergolaAttachmentResolutions,
      modules: input.modules,
      status: input.status,
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
