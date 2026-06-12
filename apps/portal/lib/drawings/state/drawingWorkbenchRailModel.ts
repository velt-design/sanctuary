import {
  labelForWorkbenchTrustStatus,
  type WorkbenchPergolaRenderStatus,
  type WorkbenchTrustStatus,
  type WorkbenchTrustStatusKind,
} from './workbenchSolvedModel';
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
import { deriveHouseFormDisplayLabel } from './houseFormDisplayLabel';

export type DrawingWorkbenchRailObjectStatus = 'ready' | 'approximate' | 'blocked' | 'deferred';

export type DrawingWorkbenchRailObjectEntry = {
  ref: WorkbenchObjectRef;
  label: string;
  status: DrawingWorkbenchRailObjectStatus;
  trustStatus: WorkbenchTrustStatusKind;
  trustLabel: string;
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
  selectedObjectTrustStatus: WorkbenchTrustStatusKind | null;
  selectedObjectTrustLabel: string | null;
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

type DrawingWorkbenchRailPergolaRenderState = {
  pergolaId: string | null | undefined;
  planRenderStatus: WorkbenchPergolaRenderStatus;
  trust: WorkbenchTrustStatus;
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
      'Select a house form to edit its footprint, roof, and attachment context.',
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

function buildTrustLabel(status: WorkbenchTrustStatusKind): string {
  return labelForWorkbenchTrustStatus(status);
}

function describeHouseFootprint(houseForm: HouseFormModel): string {
  return houseForm.footprint.mode === 'custom_polygon' ? 'Custom footprint' : 'Footprint ready';
}

function railStatusForTrustStatus(status: WorkbenchTrustStatusKind): DrawingWorkbenchRailObjectStatus {
  switch (status) {
    case 'invalid_geometry':
    case 'unresolved_host':
      return 'blocked';
    case 'approximate':
      return 'approximate';
    case 'geometry_ready':
    default:
      return 'ready';
  }
}

function resolvePergolaRenderTrustStatus(trust: WorkbenchTrustStatus): WorkbenchTrustStatusKind {
  if (trust.status === 'invalid_geometry' || trust.issues.includes('invalid_geometry')) {
    return 'invalid_geometry';
  }
  if (trust.status === 'unresolved_host' || trust.issues.includes('unresolved_host')) {
    return 'unresolved_host';
  }
  if (trust.status === 'approximate' || trust.issues.includes('approximate')) {
    return 'approximate';
  }
  return trust.status;
}

function buildHouseFormEntries(
  houseForms: HouseFormModel[],
  activeTrust: WorkbenchTrustStatus,
  status: ObjectWorkbenchStatusFacade,
): DrawingWorkbenchRailObjectEntry[] {
  return houseForms.map((houseForm, index) => {
    const houseStatus = status.houseFormsById[houseForm.id] ?? null;
    const warningCount = houseStatus?.warnings.length ?? 0;
    const roofStatus = houseStatus?.roof?.validationStatus ?? null;
    const trustStatus: WorkbenchTrustStatusKind =
      roofStatus === 'invalid'
        ? 'invalid_geometry'
        : roofStatus === 'approximate' || houseStatus?.lowConfidence || warningCount > 0
          ? 'approximate'
          : activeTrust.status;
    const trustLabel = buildTrustLabel(trustStatus);
    return {
      ref: {
        family: 'house_forms',
        objectId: houseForm.id,
      },
      label: deriveHouseFormDisplayLabel(index),
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
      meta: `${describeHouseFootprint(houseForm)} | ${
        houseStatus?.roofForm ?? houseForm.roofIntent.form
      } roof | ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
    };
  });
}

function buildDeckEntries(input: {
  decks: DeckObjectModel[];
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailObjectEntry[] {
  return input.decks.map((deck, index) => {
    const deckStatus = input.status.deckStatuses[deck.id] ?? null;
    const trustStatus: WorkbenchTrustStatusKind =
      deckStatus?.validation.status === 'invalid' ? 'invalid_geometry' : 'geometry_ready';
    const trustLabel = buildTrustLabel(trustStatus);
    return {
      ref: {
        family: 'decks',
        objectId: deck.id,
      },
      // PR-T9 (2026-05-29): `deck.label` removed; auto-derive from index.
      label: `Deck ${index + 1}`,
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
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
    const hasInvalidGeometry =
      openingStatus?.validation.status === 'invalid' &&
      openingStatus.validation.codes.some((code) => code !== 'missing_host_wall');
    const trustStatus: WorkbenchTrustStatusKind =
      hasInvalidGeometry
        ? 'invalid_geometry'
        : hostResolution?.status === 'unresolved'
          ? 'unresolved_host'
          : 'geometry_ready';
    const trustLabel = buildTrustLabel(trustStatus);
    return {
      ref: {
        family: 'openings',
        objectId: opening.id,
      },
      label: opening.label,
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
      meta: `${opening.kind.replace('_', ' ')} | ${hostWallLabel}`,
    };
  });
}

function resolvePergolaEntryStatus(input: {
  pergola: PergolaObjectModel;
  attachmentResolution: ObjectFirstPergolaAttachmentResolution | null;
  renderStates: DrawingWorkbenchRailPergolaRenderState[];
  status: ObjectWorkbenchStatusFacade;
}): Pick<DrawingWorkbenchRailObjectEntry, 'status' | 'statusLabel' | 'trustStatus' | 'trustLabel'> {
  const pergolaStatus = input.status.pergolaStatuses[input.pergola.id] ?? null;
  const isFreestanding = pergolaStatus?.isFreestanding;
  const renderTrustStatus = input.renderStates
    .map((state) => resolvePergolaRenderTrustStatus(state.trust))
    .find((status) => status !== 'geometry_ready') ?? null;
  const trustStatus: WorkbenchTrustStatusKind =
    !isFreestanding && input.attachmentResolution?.status === 'unresolved'
      ? 'unresolved_host'
      : renderTrustStatus ??
        (pergolaStatus?.confidence === 'low' ? 'approximate' : 'geometry_ready');
  const trustLabel = buildTrustLabel(trustStatus);
  if (!isFreestanding && input.attachmentResolution?.status === 'unresolved') {
    return {
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
    };
  }
  if (input.renderStates.some((state) => state.planRenderStatus === 'invalid_geometry')) {
    return {
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
    };
  }
  if (pergolaStatus?.confidence === 'low') {
    return {
      status: railStatusForTrustStatus(trustStatus),
      trustStatus,
      trustLabel,
      statusLabel: trustLabel,
    };
  }
  return {
    status: railStatusForTrustStatus(trustStatus),
    trustStatus,
    trustLabel,
    statusLabel: trustLabel,
  };
}

function buildPergolaEntries(input: {
  pergolas: PergolaObjectModel[];
  attachmentResolutions: Record<string, ObjectFirstPergolaAttachmentResolution>;
  pergolaRenderStates: DrawingWorkbenchRailPergolaRenderState[];
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailObjectEntry[] {
  return input.pergolas.map((pergola) => {
    const pergolaStatus = input.status.pergolaStatuses[pergola.id] ?? null;
    const attachmentResolution = input.attachmentResolutions[pergola.id] ?? null;
    const renderStates = input.pergolaRenderStates.filter((state) => state.pergolaId === pergola.id);
    const entryStatus = resolvePergolaEntryStatus({
      pergola,
      attachmentResolution,
      renderStates,
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
      trustStatus: entryStatus.trustStatus,
      trustLabel: entryStatus.trustLabel,
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
  pergolaRenderStates: DrawingWorkbenchRailPergolaRenderState[];
  activeTrust: WorkbenchTrustStatus;
  status: ObjectWorkbenchStatusFacade;
}): DrawingWorkbenchRailModel {
  const objectLists: Record<WorkbenchObjectFamily, DrawingWorkbenchRailObjectEntry[]> = {
    house_forms: buildHouseFormEntries(input.houseForms, input.activeTrust, input.status),
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
      pergolaRenderStates: input.pergolaRenderStates,
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
      selectedObjectTrustStatus: selectedEntry?.trustStatus ?? null,
      selectedObjectTrustLabel: selectedEntry?.trustLabel ?? null,
      selectedObjectStatusLabel: selectedEntry?.statusLabel ?? null,
      selectedObjectMeta: selectedEntry?.meta ?? null,
      emptyTitle: selectedDescriptor.emptyTitle,
      emptyMessage: selectedDescriptor.emptyMessage,
      addActionLabels: selectedDescriptor.addActionLabels,
    },
  };
}
