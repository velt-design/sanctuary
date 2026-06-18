import {
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  getHouseRoofFormBehavior,
  type HouseRoofStageDiagnostics,
} from '@sp/geometry';
import type { DeckInteractionCapability } from '@/lib/drawings/interactions/deckInteractionContract';
import type { WorkbenchDeckSupportDiagnostic } from './deckSupportDiagnostics';
import type {
  ObjectFirstOpeningHostResolution,
  ObjectFirstPergolaAttachmentResolution,
} from './objectFirstDerivedHosting';
import type {
  DeckObjectModel,
  HouseAssemblyModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
  ObjectFirstWorkbenchProjectModel,
  ObjectFirstPergolaConnectionKind,
  ObjectFirstPergolaGeometryDraft,
  ObjectFirstPergolaPosition,
  OpeningObjectModel,
  PergolaAttachment,
  PergolaObjectModel,
  WorkbenchObjectRef,
} from './objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchMigrationWarning,
  ObjectWorkbenchHouseFormStatus,
  ObjectWorkbenchPergolaAttachmentStrategy,
  ObjectWorkbenchPergolaConnectionKind,
  ObjectWorkbenchRoofFailingStage,
  ObjectWorkbenchRoofProvenance,
  ObjectWorkbenchStatusFacade,
} from './objectWorkbenchStatusModel';
import {
  labelForWorkbenchTrustStatus,
  type WorkbenchTrustStatus,
  type WorkbenchTrustStatusKind,
} from './workbenchSolvedModel';
import { deriveHouseFormRoofIntentForFootprint } from './houseFormRoofIntentForFootprint';
import type { ProjectHouseProjectionHealth } from './projectHouseProjectionHealth';
import type { ProjectPergolaRenderHealth } from './projectObjectRenderPipeline';

// PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed.
export type ObjectWorkbenchDeckPatch = Partial<
  Pick<
    DeckObjectModel,
    | 'shape'
    | 'presetType'
    | 'presetRect'
    | 'floatingRect'
    | 'outline'
    | 'hostEdgeId'
    | 'levelOffsetMm'
    | 'surfaceMaterial'
    | 'isAttached'
    | 'attachmentMode'
    | 'primaryHostEdgeId'
    | 'secondaryHostEdgeId'
    | 'cornerVertexId'
    | 'position'
  >
>;

export type ObjectWorkbenchOpeningPatch = Partial<
  Pick<
    OpeningObjectModel,
    | 'label'
    | 'kind'
    | 'panelCount'
    | 'hostWallId'
    | 'sourceFormId'
    | 'wallId'
    | 'hostEdgeId'
    | 'widthM'
    | 'heightM'
    | 'sillHeightM'
    | 'offsetAlongWallM'
  >
>;

export type ObjectWorkbenchPergolaPatch = Partial<
  Pick<
    PergolaObjectModel,
    | 'label'
    | 'family'
    | 'connectionKind'
    | 'attachmentEdgeId'
    | 'attachmentZoneId'
    | 'side'
    | 'strategy'
  >
> & {
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  geometry?: ObjectFirstPergolaGeometryDraft | null;
  /** Phase 2 free-floating-objects: setting `position` makes the pergola sit at
   *  a fixed world location regardless of `connection.type` + house attachment. */
  position?: ObjectFirstPergolaPosition | null;
  /** Step 8 snap-derived attachment data. Replaces the legacy connection.type +
   *  attachmentSide + attachmentStrategy triple as the source of truth. See
   *  `PergolaAttachment` for invariants. */
  attachment?: PergolaAttachment | null;
};

// Note: legacy re-exports (`ObjectWorkbenchMigrationWarning`,
// `ObjectWorkbenchPergolaAttachmentStrategy`, `ObjectWorkbenchPergolaConnectionKind`,
// `ObjectWorkbenchRoofProvenance`) were removed in the Step 9 cleanup pass —
// import them directly from `./objectWorkbenchStatusModel` if needed.

export type ObjectWorkbenchRoofInspectorModel = {
  intent: HouseFormRoofIntentModel;
  controls: ReturnType<typeof getHouseRoofFormBehavior>['controls'];
  selectedFormSupported: boolean;
  terminalEnds: Array<{
    id: string;
    label: string;
    isOpen: boolean;
  }>;
  geometryKind: string | null;
  validationStatus: 'valid' | 'approximate' | 'invalid' | null;
  validationCode: string | null;
  validationMessage: string | null;
  approximationReasons: string[];
  /**
   * PR-HR2 (2026-06-18): forwarded from the status model so the
   * inspector rail's `RoofValidationPanel` can build a structured
   * failure UI + "Copy diagnostics" payload without a second
   * resolver pass.
   */
  stageDiagnostics: HouseRoofStageDiagnostics;
  failingStage: ObjectWorkbenchRoofFailingStage | null;
  provenance: ObjectWorkbenchRoofProvenance;
};

export type ObjectWorkbenchHouseFormInspectorModel = {
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  houseForms: HouseFormModel[];
  roof: ObjectWorkbenchRoofInspectorModel;
  trustStatus: WorkbenchTrustStatusKind;
  trustLabel: string;
  deckCount: number;
  openingCount: number;
  pergolaCount: number;
  warnings: ObjectWorkbenchMigrationWarning[];
  lowConfidence: boolean;
};

export type ObjectWorkbenchDeckInspectorModel = Omit<DeckObjectModel, 'validation'> & {
  defaultHostEdgeId: string;
  trustStatus: WorkbenchTrustStatusKind;
  trustLabel: string;
  validation: {
    status: 'valid' | 'invalid';
    codes: string[];
    messages: string[];
    message: string | null;
  };
  supportWarnings: {
    codes: string[];
    messages: string[];
  };
};

export type ObjectWorkbenchOpeningInspectorModel = Omit<OpeningObjectModel, 'validation'> & {
  trustStatus: WorkbenchTrustStatusKind;
  trustLabel: string;
  validation: {
    status: 'valid' | 'invalid';
    codes: string[];
    message: string | null;
  };
  hostWallOptions: Array<{
    label: string;
    value: string;
  }>;
  hostResolution: ObjectFirstOpeningHostResolution | null;
};

export type ObjectWorkbenchPergolaInspectorModel = PergolaObjectModel & {
  trustStatus: WorkbenchTrustStatusKind;
  trustLabel: string;
  connectionKind: ObjectWorkbenchPergolaConnectionKind;
  attachmentStrategy: ObjectWorkbenchPergolaAttachmentStrategy;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  resolution: {
    status: 'resolved' | 'unresolved' | 'ambiguous';
    message: string | null;
  };
};

export type ObjectWorkbenchDiagnosticsModel = {
  houseCount: number;
  pergolaCount: number;
  deckCount: number;
  openingCount: number;
  attachmentZoneCount: number;
  attachmentZoneKindsSummary: string;
  attachmentZoneBlockedSummary: string;
  resolvedPergolaAttachmentZoneCount: number;
  unresolvedPergolaAttachmentZoneCount: number;
  sliderOpeningCount: number;
  invalidOpeningCount: number;
  snappedPresetDeckCount: number;
  floatingPresetDeckCount: number;
  customDeckCount: number;
  invalidDeckCount: number;
  deckSupportWarningCount: number;
  activeDeckId: string | null;
  activeOpeningId: string | null;
  activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
  activeDeckInteraction: DeckInteractionCapability | null;
  footprintSource: 'custom_saved' | 'preset_derived' | null;
  lowConfidence: boolean;
  migrationWarningCount: number;
  activeTrust: WorkbenchTrustStatus;
  activeTrustLabel: string;
  roof: ObjectWorkbenchRoofInspectorModel;
  projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
  projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
};

export type ObjectWorkbenchInspectorFacade = {
  houseForm: ObjectWorkbenchHouseFormInspectorModel;
  decks: ObjectWorkbenchDeckInspectorModel[];
  openings: ObjectWorkbenchOpeningInspectorModel[];
  pergolas: ObjectWorkbenchPergolaInspectorModel[];
  activeDeck: ObjectWorkbenchDeckInspectorModel | null;
  activeOpening: ObjectWorkbenchOpeningInspectorModel | null;
  activePergola: ObjectWorkbenchPergolaInspectorModel | null;
  diagnostics: ObjectWorkbenchDiagnosticsModel;
};

type BuildObjectWorkbenchInspectorFacadeInput = {
  activeObjectRef: WorkbenchObjectRef;
  activeTrust: WorkbenchTrustStatus;
  houseAssembly: HouseAssemblyModel | null;
  openingHostResolutions: Map<string, ObjectFirstOpeningHostResolution>;
  pergolaAttachmentResolutions: Map<string, ObjectFirstPergolaAttachmentResolution>;
  projectModel: ObjectFirstWorkbenchProjectModel;
  projectHouseProjectionHealth?: ReadonlyArray<ProjectHouseProjectionHealth>;
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealth>;
  status: ObjectWorkbenchStatusFacade;
};

function buildFallbackRoofIntent(houseForm: HouseFormModel | null): HouseFormRoofIntentModel {
  return houseForm
    ? deriveHouseFormRoofIntentForFootprint({ houseForm })
    : {
        form: 'mono',
        material: 'corrugated_iron',
        primaryPitchDeg: '',
        primaryFallDirection: 'positive_y',
        ridgeAxis: 'x',
        openGableEndIds: [],
      };
}

function buildRoofInspector(
  houseForm: HouseFormModel | null,
  houseFormStatus: ObjectWorkbenchHouseFormStatus | null,
): ObjectWorkbenchRoofInspectorModel {
  const intent = buildFallbackRoofIntent(houseForm);
  const roof = houseFormStatus?.roof ?? null;
  const fallbackControls = getHouseRoofFormBehavior(intent.form).controls;

  return {
    intent,
    controls: roof?.controls ?? fallbackControls,
    selectedFormSupported: roof?.selectedFormSupported ?? true,
    terminalEnds: roof?.terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      isOpen: end.isOpen,
    })) ?? [],
    geometryKind: roof?.geometryKind ?? null,
    validationStatus: roof?.validationStatus ?? null,
    validationCode: roof?.validationCode ?? null,
    validationMessage: roof?.validationMessage ?? null,
    approximationReasons: roof?.approximationReasons ?? [],
    // PR-HR2 (2026-06-18): forward stage diagnostics + failing stage
    // so the rail can render a structured validation panel without
    // having to reach back into the status facade.
    stageDiagnostics: roof?.stageDiagnostics ?? EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
    failingStage: roof?.failingStage ?? null,
    provenance: roof?.provenance ?? {},
  };
}

function resolveHouseFormTrustStatus(input: {
  activeTrust: WorkbenchTrustStatus;
  houseFormStatus: ObjectWorkbenchHouseFormStatus | null;
  roof: ObjectWorkbenchRoofInspectorModel;
}): WorkbenchTrustStatusKind {
  if (input.roof.validationStatus === 'invalid') return 'invalid_geometry';
  if (
    input.roof.validationStatus === 'approximate' ||
    input.houseFormStatus?.lowConfidence ||
    (input.houseFormStatus?.warnings.length ?? 0) > 0
  ) {
    return 'approximate';
  }
  return input.activeTrust.status;
}

function buildTrustLabel(status: WorkbenchTrustStatusKind): string {
  return labelForWorkbenchTrustStatus(status);
}

function resolveProjectTrustStatus(trust: WorkbenchTrustStatus): WorkbenchTrustStatusKind {
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

function buildDeckInspectorModels(input: {
  decks: DeckObjectModel[];
  status: ObjectWorkbenchStatusFacade;
}): ObjectWorkbenchDeckInspectorModel[] {
  const defaultHostEdgeId = input.status.selectedHouseFormStatus?.defaultDeckHostEdgeId ?? 'rear';

  return input.decks.map((deck) => {
    const deckStatus = input.status.deckStatuses[deck.id] ?? null;
    return {
      ...deck,
      defaultHostEdgeId,
      trustStatus: deckStatus?.validation.status === 'invalid' ? 'invalid_geometry' : 'geometry_ready',
      trustLabel: buildTrustLabel(
        deckStatus?.validation.status === 'invalid' ? 'invalid_geometry' : 'geometry_ready',
      ),
      validation: {
        status: deckStatus?.validation.status ?? 'valid',
        codes: deckStatus?.validation.codes ?? [],
        messages: deckStatus?.validation.messages ?? [],
        message: deckStatus?.validation.message ?? null,
      },
      supportWarnings: {
        codes: deckStatus?.supportWarnings.codes ?? [],
        messages: deckStatus?.supportWarnings.messages ?? [],
      },
    };
  });
}

function buildOpeningInspectorModels(input: {
  houseAssembly: HouseAssemblyModel | null;
  openingHostResolutions: Map<string, ObjectFirstOpeningHostResolution>;
  openings: OpeningObjectModel[];
  status: ObjectWorkbenchStatusFacade;
}): ObjectWorkbenchOpeningInspectorModel[] {
  const baseHostWallOptions =
    input.houseAssembly?.derivedEnvelope?.wallGraph.walls.map((wall) => ({
      label: wall.label,
      value: wall.id,
    })) ?? [];

  return input.openings.map((opening) => {
    const openingStatus = input.status.openingStatuses[opening.id] ?? null;
    const hostResolution = input.openingHostResolutions.get(opening.id) ?? null;
    const hasInvalidGeometry =
      openingStatus?.validation.status === 'invalid' &&
      openingStatus.validation.codes.some((code) => code !== 'missing_host_wall');
    const trustStatus: WorkbenchTrustStatusKind =
      hasInvalidGeometry
        ? 'invalid_geometry'
        : hostResolution?.status === 'unresolved'
          ? 'unresolved_host'
          : 'geometry_ready';
    const hostWallOptions =
      opening.hostWallId && !baseHostWallOptions.some((option) => option.value === opening.hostWallId)
        ? [{ label: 'Unavailable saved wall', value: opening.hostWallId }, ...baseHostWallOptions]
        : baseHostWallOptions;

    return {
      ...opening,
      trustStatus,
      trustLabel: buildTrustLabel(trustStatus),
      validation: {
        status: openingStatus?.validation.status ?? 'valid',
        codes: openingStatus?.validation.codes ?? [],
        message: openingStatus?.validation.message ?? null,
      },
      hostWallOptions,
      hostResolution,
    };
  });
}

function buildPergolaInspectorModels(input: {
  activeTrust: WorkbenchTrustStatus;
  pergolaAttachmentResolutions: Map<string, ObjectFirstPergolaAttachmentResolution>;
  pergolas: PergolaObjectModel[];
  status: ObjectWorkbenchStatusFacade;
}): ObjectWorkbenchPergolaInspectorModel[] {
  return input.pergolas.map((pergola) => {
    const pergolaStatus = input.status.pergolaStatuses[pergola.id] ?? null;
    const resolution = input.pergolaAttachmentResolutions.get(pergola.id);
    const isFreestanding = pergolaStatus?.isFreestanding ?? false;
    const projectTrustStatus = resolveProjectTrustStatus(input.activeTrust);
    const trustStatus: WorkbenchTrustStatusKind =
      !isFreestanding && resolution?.status === 'unresolved'
        ? 'unresolved_host'
        : projectTrustStatus !== 'geometry_ready'
          ? projectTrustStatus
          : pergolaStatus?.confidence === 'low'
            ? 'approximate'
            : 'geometry_ready';
    return {
      ...pergola,
      trustStatus,
      trustLabel: buildTrustLabel(trustStatus),
      connectionKind: pergolaStatus?.connectionKind ?? 'soffit',
      attachmentStrategy: pergolaStatus?.attachmentStrategy ?? pergola.strategy ?? 'auto',
      attachmentEdgeId: pergola.attachmentEdgeId,
      attachmentZoneId: pergola.attachmentZoneId,
      resolution: {
        status: resolution?.status ?? pergolaStatus?.resolution.status ?? 'unresolved',
        message: pergolaStatus?.resolution.message ?? resolution?.code ?? null,
      },
    };
  });
}

function summarizeAttachmentZoneKinds(houseAssembly: HouseAssemblyModel | null): string {
  const zones = houseAssembly?.derivedEnvelope?.attachmentZones ?? [];
  if (!zones.length) return 'none';
  const zonesBySide = new Map<string, Set<string>>();
  for (const zone of zones) {
    const existing = zonesBySide.get(zone.side) ?? new Set<string>();
    existing.add(zone.kind);
    zonesBySide.set(zone.side, existing);
  }
  return Array.from(zonesBySide.entries())
    .map(([side, kinds]) => `${side}: ${Array.from(kinds).join(', ')}`)
    .join(' | ');
}

function countPergolaAttachmentResolutions(
  pergolas: ObjectWorkbenchPergolaInspectorModel[],
): Pick<ObjectWorkbenchDiagnosticsModel, 'resolvedPergolaAttachmentZoneCount' | 'unresolvedPergolaAttachmentZoneCount'> {
  let resolvedPergolaAttachmentZoneCount = 0;
  let unresolvedPergolaAttachmentZoneCount = 0;

  for (const pergola of pergolas) {
    if (pergola.connectionKind === 'freestanding') continue;
    if (pergola.resolution.status === 'resolved' && pergola.attachmentZoneId) {
      resolvedPergolaAttachmentZoneCount += 1;
    } else {
      unresolvedPergolaAttachmentZoneCount += 1;
    }
  }

  return {
    resolvedPergolaAttachmentZoneCount,
    unresolvedPergolaAttachmentZoneCount,
  };
}

function buildDiagnostics(input: {
  activeDeck: ObjectWorkbenchDeckInspectorModel | null;
  activeDeckInteraction: DeckInteractionCapability | null;
  activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
  activeOpening: ObjectWorkbenchOpeningInspectorModel | null;
  activeTrust: WorkbenchTrustStatus;
  houseAssembly: HouseAssemblyModel | null;
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
  pergolas: ObjectWorkbenchPergolaInspectorModel[];
  projectHouseProjectionHealth: ReadonlyArray<ProjectHouseProjectionHealth>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
  status: ObjectWorkbenchStatusFacade;
}): ObjectWorkbenchDiagnosticsModel {
  const { activeDeck, activeOpening, houseAssembly, houseFormContext, pergolas } = input;
  const resolutionCounts = countPergolaAttachmentResolutions(pergolas);

  return {
    houseCount: houseFormContext.houseForms.length,
    pergolaCount: pergolas.length,
    deckCount: houseFormContext.deckCount,
    openingCount: houseFormContext.openingCount,
    attachmentZoneCount: houseAssembly?.derivedEnvelope?.attachmentZones.length ?? 0,
    attachmentZoneKindsSummary: summarizeAttachmentZoneKinds(houseAssembly),
    attachmentZoneBlockedSummary: input.status.selectedHouseFormStatus?.attachmentZoneBlockedSummary ?? 'none',
    ...resolutionCounts,
    sliderOpeningCount: 0,
    invalidOpeningCount: 0,
    snappedPresetDeckCount: 0,
    floatingPresetDeckCount: 0,
    customDeckCount: 0,
    invalidDeckCount: 0,
    deckSupportWarningCount: 0,
    activeDeckId: activeDeck?.id ?? null,
    activeOpeningId: activeOpening?.id ?? null,
    activeDeckSupport: input.activeDeckSupport,
    activeDeckInteraction: input.activeDeckInteraction,
    footprintSource: houseFormContext.houseForm
      ? houseFormContext.houseForm.footprint.mode === 'custom_polygon'
        ? 'custom_saved'
        : 'preset_derived'
      : null,
    lowConfidence: houseFormContext.lowConfidence,
    migrationWarningCount: houseFormContext.warnings.length,
    activeTrust: input.activeTrust,
    activeTrustLabel: buildTrustLabel(input.activeTrust.status),
    roof: houseFormContext.roof,
    projectHouseProjectionHealth: [...input.projectHouseProjectionHealth],
    projectPergolaRenderHealth: [...input.projectPergolaRenderHealth],
  };
}

export function buildObjectWorkbenchInspectorFacade({
  activeObjectRef,
  activeTrust,
  houseAssembly,
  openingHostResolutions,
  pergolaAttachmentResolutions,
  projectModel,
  projectHouseProjectionHealth = [],
  projectPergolaRenderHealth = [],
  status,
}: BuildObjectWorkbenchInspectorFacadeInput): ObjectWorkbenchInspectorFacade {
  const houseForms = projectModel.houseAssembly?.houseForms ?? [];
  const selectedHouseForm =
    activeObjectRef.family === 'house_forms'
      ? houseForms.find((houseForm) => houseForm.id === activeObjectRef.objectId) ?? null
      : null;
  const selectedHouseFormStatus =
    selectedHouseForm ? status.houseFormsById[selectedHouseForm.id] ?? null : null;
  const roof = buildRoofInspector(selectedHouseForm, selectedHouseFormStatus);
  const warnings = selectedHouseFormStatus?.warnings ?? [];
  const decks = buildDeckInspectorModels({
    decks: projectModel.decks,
    status,
  });
  const openings = buildOpeningInspectorModels({
    houseAssembly,
    openingHostResolutions,
    openings: projectModel.openings,
    status,
  });
  const pergolas = buildPergolaInspectorModels({
    activeTrust,
    pergolaAttachmentResolutions,
    pergolas: projectModel.pergolas,
    status,
  });
  const activeDeck =
    activeObjectRef.family === 'decks'
      ? decks.find((deck) => deck.id === activeObjectRef.objectId) ?? null
      : null;
  const activeOpening =
    activeObjectRef.family === 'openings'
      ? openings.find((opening) => opening.id === activeObjectRef.objectId) ?? null
      : null;
  const activePergola =
    activeObjectRef.family === 'pergolas'
      ? pergolas.find((pergola) => pergola.id === activeObjectRef.objectId) ?? null
      : null;
  const houseFormTrustStatus = resolveHouseFormTrustStatus({
    activeTrust,
    houseFormStatus: selectedHouseFormStatus,
    roof,
  });
  const houseFormContext: ObjectWorkbenchHouseFormInspectorModel = {
    houseAssembly,
    houseForm: selectedHouseForm,
    houseForms,
    roof,
    trustStatus: houseFormTrustStatus,
    trustLabel: buildTrustLabel(houseFormTrustStatus),
    deckCount: decks.length,
    openingCount: openings.length,
    pergolaCount: pergolas.length,
    warnings,
    lowConfidence: selectedHouseFormStatus?.lowConfidence ?? false,
  };
  const diagnostics = buildDiagnostics({
    activeDeck,
    activeDeckInteraction: status.activeDeckInteraction,
    activeDeckSupport: status.activeDeckSupport,
    activeTrust,
    activeOpening,
    houseAssembly,
    houseFormContext,
    pergolas,
    projectHouseProjectionHealth,
    projectPergolaRenderHealth,
    status,
  });

  return {
    houseForm: houseFormContext,
    decks,
    openings,
    pergolas,
    activeDeck,
    activeOpening,
    activePergola,
    diagnostics: {
      ...diagnostics,
      sliderOpeningCount: openings.filter((opening) => opening.kind === 'slider').length,
      invalidOpeningCount: openings.filter((opening) => opening.validation.status === 'invalid').length,
      snappedPresetDeckCount: decks.filter((deck) => deck.shape === 'preset' && deck.isAttached).length,
      floatingPresetDeckCount: decks.filter((deck) => deck.shape === 'preset' && !deck.isAttached).length,
      customDeckCount: decks.filter((deck) => deck.shape === 'custom').length,
      invalidDeckCount: decks.filter((deck) => deck.validation.status === 'invalid').length,
      deckSupportWarningCount: decks.reduce((sum, deck) => sum + deck.supportWarnings.codes.length, 0),
    },
  };
}
