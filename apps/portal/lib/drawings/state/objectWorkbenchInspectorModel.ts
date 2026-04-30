import { getHouseRoofFormBehavior } from '@sp/geometry';
import type { CalculatorHouseAttachmentStrategy, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { DeckInteractionCapability } from '@/lib/drawings/interactions/deckInteractionContract';
import type {
  ObjectWorkbenchCompatibilityMigrationWarning,
  ObjectWorkbenchCompatibilityProjectModel,
  ObjectWorkbenchCompatibilityHouseModel,
  ObjectWorkbenchCompatibilityPergolaModel,
} from './compat/objectWorkbenchCompatibilityModel';
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
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchObjectRef,
} from './objectFirstWorkbenchModel';

export type ObjectWorkbenchDeckPatch = Partial<
  Pick<
    DeckObjectModel,
    | 'label'
    | 'kind'
    | 'shape'
    | 'presetType'
    | 'presetRect'
    | 'floatingRect'
    | 'outline'
    | 'hostEdgeId'
    | 'elevationMode'
    | 'levelOffsetMm'
    | 'surfaceMaterial'
    | 'isAttached'
    | 'attachmentMode'
    | 'primaryHostEdgeId'
    | 'secondaryHostEdgeId'
    | 'cornerVertexId'
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

export type ObjectWorkbenchPergolaConnectionKind = 'freestanding' | 'soffit' | 'fascia' | 'wall';

export type ObjectWorkbenchPergolaAttachmentStrategy = CalculatorHouseAttachmentStrategy | 'auto';

export type ObjectWorkbenchMigrationWarning = Pick<
  ObjectWorkbenchCompatibilityMigrationWarning,
  'id' | 'code' | 'field' | 'message' | 'severity'
>;

export type ObjectWorkbenchRoofProvenance = Partial<
  Record<
    | 'form'
    | 'material'
    | 'primaryPitchDeg'
    | 'primaryFallDirection'
    | 'ridgeAxis'
    | 'openGableEndIds'
    | 'appendage',
    string | null
  >
>;

export type ObjectWorkbenchRoofInspectorModel = {
  intent: HouseFormRoofIntentModel;
  controls: ReturnType<typeof getHouseRoofFormBehavior>['controls'];
  selectedFormSupported: boolean;
  appendageSupported: boolean;
  appendageSupportedHostEdges: Array<NonNullable<CalculatorModuleInputs['attachmentSide']>>;
  appendageSupportReason: string | null;
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
  provenance: ObjectWorkbenchRoofProvenance;
};

export type ObjectWorkbenchHouseFormInspectorModel = {
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  houseForms: HouseFormModel[];
  roof: ObjectWorkbenchRoofInspectorModel;
  deckCount: number;
  openingCount: number;
  pergolaCount: number;
  warnings: ObjectWorkbenchMigrationWarning[];
  lowConfidence: boolean;
};

export type ObjectWorkbenchDeckInspectorModel = DeckObjectModel & {
  defaultHostEdgeId: string;
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

export type ObjectWorkbenchOpeningInspectorModel = OpeningObjectModel & {
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
  footprintSource: 'custom_saved' | 'preset_derived';
  lowConfidence: boolean;
  migrationWarningCount: number;
  roof: ObjectWorkbenchRoofInspectorModel;
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
  activeDeckInteraction: DeckInteractionCapability | null;
  activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
  activeObjectRef: WorkbenchObjectRef;
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel;
  houseAssembly: HouseAssemblyModel | null;
  openingHostResolutions: Map<string, ObjectFirstOpeningHostResolution>;
  pergolaAttachmentResolutions: Map<string, ObjectFirstPergolaAttachmentResolution>;
  projectModel: ObjectFirstWorkbenchProjectModel;
};

function buildFallbackRoofIntent(houseForm: HouseFormModel | null): HouseFormRoofIntentModel {
  return houseForm?.roofIntent ?? {
    form: 'mono',
    material: 'corrugated_iron',
    primaryPitchDeg: '',
    primaryFallDirection: 'positive_y',
    ridgeAxis: 'x',
    openGableEndIds: [],
    appendage: {
      enabled: false,
      form: 'mono',
      hostEdge: 'rear',
      pitchDeg: '',
      dropMm: '450',
    },
  };
}

function buildRoofInspector(
  houseForm: HouseFormModel | null,
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null,
): ObjectWorkbenchRoofInspectorModel {
  const intent = buildFallbackRoofIntent(houseForm);
  const roof = compatibilityHouse?.roof ?? null;
  const fallbackControls = getHouseRoofFormBehavior(intent.form).controls;

  return {
    intent,
    controls: roof?.capabilities.controls ?? fallbackControls,
    selectedFormSupported: roof?.capabilities.selectedFormSupported ?? true,
    appendageSupported: roof?.capabilities.appendageSupported ?? false,
    appendageSupportedHostEdges: roof?.appendageSupportedHostEdges ?? [],
    appendageSupportReason: roof?.appendageSupportReason ?? null,
    terminalEnds: roof?.terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      isOpen: end.isOpen,
    })) ?? [],
    geometryKind: roof?.geometryKind ?? null,
    validationStatus: roof?.validation.status ?? null,
    validationCode: roof?.validation.code ?? null,
    validationMessage: roof?.validation.message ?? null,
    approximationReasons: roof?.validation.approximationReasons ?? [],
    provenance: roof?.provenance ?? {},
  };
}

function buildMigrationWarnings(
  warnings: ObjectWorkbenchCompatibilityMigrationWarning[],
): ObjectWorkbenchMigrationWarning[] {
  return warnings.map((warning) => ({
    id: warning.id,
    code: warning.code,
    field: warning.field,
    message: warning.message,
    severity: warning.severity,
  }));
}

function buildDeckInspectorModels(input: {
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null;
  decks: DeckObjectModel[];
}): ObjectWorkbenchDeckInspectorModel[] {
  const compatibilityDecksById = new Map(
    (input.compatibilityHouse?.decks ?? []).map((deck) => [deck.id, deck]),
  );
  const defaultHostEdgeId = input.compatibilityHouse?.footprint.attachmentSide ?? 'rear';

  return input.decks.map((deck) => {
    const compatibilityDeck = compatibilityDecksById.get(deck.id) ?? null;
    return {
      ...deck,
      defaultHostEdgeId,
      validation: {
        status: compatibilityDeck?.validation.status ?? 'valid',
        codes: compatibilityDeck?.validation.codes ?? [],
        messages: compatibilityDeck?.validation.messages ?? [],
        message: compatibilityDeck?.validation.message ?? null,
      },
      supportWarnings: {
        codes: compatibilityDeck?.supportContext.warningCodes ?? [],
        messages: compatibilityDeck?.supportContext.warningMessages ?? [],
      },
    };
  });
}

function buildOpeningInspectorModels(input: {
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null;
  houseAssembly: HouseAssemblyModel | null;
  openingHostResolutions: Map<string, ObjectFirstOpeningHostResolution>;
  openings: OpeningObjectModel[];
}): ObjectWorkbenchOpeningInspectorModel[] {
  const compatibilityOpeningsById = new Map(
    (input.compatibilityHouse?.openings ?? []).map((opening) => [opening.id, opening]),
  );
  const baseHostWallOptions =
    input.houseAssembly?.derivedEnvelope?.wallGraph.walls.map((wall) => ({
      label: wall.label,
      value: wall.id,
    })) ?? [];

  return input.openings.map((opening) => {
    const compatibilityOpening = compatibilityOpeningsById.get(opening.id) ?? null;
    const hostWallOptions =
      opening.hostWallId && !baseHostWallOptions.some((option) => option.value === opening.hostWallId)
        ? [{ label: 'Unavailable saved wall', value: opening.hostWallId }, ...baseHostWallOptions]
        : baseHostWallOptions;

    return {
      ...opening,
      validation: {
        status: compatibilityOpening?.validation.status ?? 'valid',
        codes: compatibilityOpening?.validation.codes ?? [],
        message: compatibilityOpening?.validation.message ?? null,
      },
      hostWallOptions,
      hostResolution: input.openingHostResolutions.get(opening.id) ?? null,
    };
  });
}

function buildPergolaInspectorModels(input: {
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel;
  pergolaAttachmentResolutions: Map<string, ObjectFirstPergolaAttachmentResolution>;
  pergolas: PergolaObjectModel[];
}): ObjectWorkbenchPergolaInspectorModel[] {
  const compatibilityPergolasById = new Map(
    (input.compatibilityProjectModel.pergolas ?? []).map((pergola) => [pergola.id, pergola]),
  );

  return input.pergolas.map((pergola) => {
    const compatibilityPergola = compatibilityPergolasById.get(pergola.id) ?? null;
    const resolution = input.pergolaAttachmentResolutions.get(pergola.id);
    return {
      ...pergola,
      connectionKind: compatibilityPergola?.attachment.kind ?? 'soffit',
      attachmentStrategy: compatibilityPergola?.attachment.strategy ?? pergola.strategy ?? 'auto',
      attachmentEdgeId: pergola.attachmentEdgeId,
      attachmentZoneId: pergola.attachmentZoneId,
      resolution: {
        status: resolution?.status ?? compatibilityPergola?.attachment.resolution.status ?? 'unresolved',
        message: compatibilityPergola?.attachment.resolution.message ?? resolution?.code ?? null,
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

function summarizeAttachmentZoneBlocks(compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null): string {
  const blocked = compatibilityHouse?.attachmentZoneDiagnostics.blocked ?? [];
  if (!blocked.length) return 'none';
  return Array.from(
    new Set(blocked.map((entry) => `${entry.side} ${entry.kind} (${entry.reason})`)),
  ).join(' | ');
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
  compatibilityHouse: ObjectWorkbenchCompatibilityHouseModel | null;
  houseAssembly: HouseAssemblyModel | null;
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
  pergolas: ObjectWorkbenchPergolaInspectorModel[];
}): ObjectWorkbenchDiagnosticsModel {
  const { activeDeck, activeOpening, compatibilityHouse, houseAssembly, houseFormContext, pergolas } = input;
  const resolutionCounts = countPergolaAttachmentResolutions(pergolas);

  return {
    houseCount: houseFormContext.houseForms.length,
    pergolaCount: pergolas.length,
    deckCount: houseFormContext.deckCount,
    openingCount: houseFormContext.openingCount,
    attachmentZoneCount: houseAssembly?.derivedEnvelope?.attachmentZones.length ?? 0,
    attachmentZoneKindsSummary: summarizeAttachmentZoneKinds(houseAssembly),
    attachmentZoneBlockedSummary: summarizeAttachmentZoneBlocks(compatibilityHouse),
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
    footprintSource: houseFormContext.houseForm?.footprint.mode === 'custom_polygon' ? 'custom_saved' : 'preset_derived',
    lowConfidence: houseFormContext.lowConfidence,
    migrationWarningCount: houseFormContext.warnings.length,
    roof: houseFormContext.roof,
  };
}

export function buildObjectWorkbenchInspectorFacade({
  activeDeckInteraction,
  activeDeckSupport,
  activeObjectRef,
  compatibilityProjectModel,
  houseAssembly,
  openingHostResolutions,
  pergolaAttachmentResolutions,
  projectModel,
}: BuildObjectWorkbenchInspectorFacadeInput): ObjectWorkbenchInspectorFacade {
  const compatibilityHouse = compatibilityProjectModel.house;
  const houseForms = projectModel.houseAssembly?.houseForms ?? [];
  const selectedHouseForm =
    activeObjectRef.family === 'house_forms'
      ? houseForms.find((houseForm) => houseForm.id === activeObjectRef.objectId) ?? houseForms[0] ?? null
      : houseForms[0] ?? null;
  const roof = buildRoofInspector(selectedHouseForm, compatibilityHouse);
  const warnings = buildMigrationWarnings(compatibilityProjectModel.warnings ?? []);
  const decks = buildDeckInspectorModels({
    compatibilityHouse,
    decks: projectModel.decks,
  });
  const openings = buildOpeningInspectorModels({
    compatibilityHouse,
    houseAssembly,
    openingHostResolutions,
    openings: projectModel.openings,
  });
  const pergolas = buildPergolaInspectorModels({
    compatibilityProjectModel,
    pergolaAttachmentResolutions,
    pergolas: projectModel.pergolas,
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
  const houseFormContext: ObjectWorkbenchHouseFormInspectorModel = {
    houseAssembly,
    houseForm: selectedHouseForm,
    houseForms,
    roof,
    deckCount: decks.length,
    openingCount: openings.length,
    pergolaCount: pergolas.length,
    warnings,
    lowConfidence: compatibilityHouse?.lowConfidence ?? warnings.length > 0,
  };
  const diagnostics = buildDiagnostics({
    activeDeck,
    activeDeckInteraction,
    activeDeckSupport,
    activeOpening,
    compatibilityHouse,
    houseAssembly,
    houseFormContext,
    pergolas,
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
