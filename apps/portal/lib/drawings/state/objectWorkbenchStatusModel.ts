import {
  deriveHouseGableTerminalEnds,
  deriveHouseRoofAppendageSupportedHostEdges,
  deriveHouseRoofAppendageSupport,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  getHouseRoofFormBehavior,
  preferredMonoFallDirectionForAttachmentSide,
  validateHouseRoofSelection,
  type Polygon3,
} from '@sp/geometry';
import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  resolveDeckInteractionCapability,
  type DeckInteractionCapability,
} from '@/lib/drawings/interactions/deckInteractionContract';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type {
  DeckObjectModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';

type AttachmentSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;

const ATTACHMENT_SIDES: readonly AttachmentSide[] = ['rear', 'front', 'left', 'right'];

export type ObjectWorkbenchMigrationWarning = {
  id: string;
  code: string;
  field: string;
  message: string;
  severity: 'blocking';
};

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

export type ObjectWorkbenchRoofStatus = {
  form: HouseFormRoofIntentModel['form'];
  controls: ReturnType<typeof getHouseRoofFormBehavior>['controls'];
  selectedFormSupported: boolean;
  appendageSupported: boolean;
  appendageSupportedHostEdges: AttachmentSide[];
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

export type ObjectWorkbenchRoofCompatibilityStatus = ObjectWorkbenchRoofStatus;

export type ObjectWorkbenchHouseFormStatus = {
  lowConfidence: boolean;
  warnings: ObjectWorkbenchMigrationWarning[];
  footprintPreset: string | null;
  roofForm: string | null;
  defaultDeckHostEdgeId: AttachmentSide;
  attachmentZoneBlockedSummary: string;
  roof: ObjectWorkbenchRoofStatus | null;
};

export type ObjectWorkbenchDeckStatus = {
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
  interaction: DeckInteractionCapability;
};

export type ObjectWorkbenchOpeningStatus = {
  validation: {
    status: 'valid' | 'invalid';
    codes: string[];
    message: string | null;
  };
};

export type ObjectWorkbenchPergolaConnectionKind = 'freestanding' | 'soffit' | 'fascia' | 'wall';

export type ObjectWorkbenchPergolaAttachmentStrategy = CalculatorHouseAttachmentStrategy | 'auto';

export type ObjectWorkbenchPergolaStatus = {
  connectionKind: ObjectWorkbenchPergolaConnectionKind;
  attachmentStrategy: ObjectWorkbenchPergolaAttachmentStrategy;
  confidence: 'high' | 'low';
  isFreestanding: boolean;
  resolution: {
    status: 'resolved' | 'unresolved' | 'ambiguous';
    message: string | null;
  };
};

export type ObjectWorkbenchStatusFacade = {
  houseForm: ObjectWorkbenchHouseFormStatus;
  deckStatuses: Record<string, ObjectWorkbenchDeckStatus>;
  openingStatuses: Record<string, ObjectWorkbenchOpeningStatus>;
  pergolaStatuses: Record<string, ObjectWorkbenchPergolaStatus>;
  activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
  activeDeckInteraction: DeckInteractionCapability | null;
  deckSupportWarningCount: number;
};

function isAttachmentSide(value: string | null | undefined): value is AttachmentSide {
  return ATTACHMENT_SIDES.includes(value as AttachmentSide);
}

function parseFiniteNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localPolygonToGeometryPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}

function isOrthogonal2D(polygon: CalculatorHouseFootprintPolygonPoint[]): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const alongStart = Number(start.alongM);
    const alongEnd = Number(end.alongM);
    const depthStart = Number(start.depthM);
    const depthEnd = Number(end.depthM);
    if (
      !Number.isFinite(alongStart) ||
      !Number.isFinite(alongEnd) ||
      !Number.isFinite(depthStart) ||
      !Number.isFinite(depthEnd)
    ) {
      return false;
    }
    if (Math.abs(alongStart - alongEnd) > 1e-6 && Math.abs(depthStart - depthEnd) > 1e-6) {
      return false;
    }
  }
  return true;
}

function resolveBoundingFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!polygon.length) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  if (
    alongValues.some((value) => !Number.isFinite(value)) ||
    depthValues.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

function isRectanglePolygon2D(polygon: CalculatorHouseFootprintPolygonPoint[]): boolean {
  if (polygon.length !== 4 || !isOrthogonal2D(polygon)) return false;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  return (
    new Set(alongValues.map((value) => value.toFixed(6))).size === 2 &&
    new Set(depthValues.map((value) => value.toFixed(6))).size === 2
  );
}

function resolveRectangularFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!isRectanglePolygon2D(polygon)) return null;
  return resolveBoundingFootprintSpans(polygon);
}

function resolvePreferredRidgeAxis(input: {
  footprint: Polygon3;
  polygon: CalculatorHouseFootprintPolygonPoint[];
  fallback: HouseFormRoofIntentModel['ridgeAxis'];
}): HouseFormRoofIntentModel['ridgeAxis'] {
  const rectangularSpans = resolveRectangularFootprintSpans(input.polygon);
  if (rectangularSpans) {
    return rectangularSpans.alongM >= rectangularSpans.depthM ? 'x' : 'y';
  }

  if (isOrthogonal2D(input.polygon)) {
    const xScore = deriveHouseGableTerminalEnds({
      footprint: input.footprint,
      ridgeAxis: 'x',
    }).length;
    const yScore = deriveHouseGableTerminalEnds({
      footprint: input.footprint,
      ridgeAxis: 'y',
    }).length;
    if (xScore > yScore) return 'x';
    if (yScore > xScore) return 'y';
  }

  const spans = resolveBoundingFootprintSpans(input.polygon);
  if (spans) {
    if (spans.alongM > spans.depthM * 1.05) return 'x';
    if (spans.depthM > spans.alongM * 1.05) return 'y';
  }
  return input.fallback;
}

function activeAttachmentRequiresDrainEdge(
  module: Partial<CalculatorModuleInputs> | null | undefined,
): boolean {
  return module?.houseConnectionType === 'soffit' || module?.houseConnectionType === 'fascia';
}

function buildMigrationWarnings(warnings: string[]): ObjectWorkbenchMigrationWarning[] {
  return warnings
    .map((warning) => warning.trim())
    .filter((warning) => warning.length > 0)
    .map((warning, index) => ({
      id: `legacy-estimate-warning-${index + 1}`,
      code: 'legacy_estimate_snapshot_warning',
      field: 'legacy_estimate_snapshot',
      message: warning,
      severity: 'blocking',
    }));
}

function buildRoofProvenance(houseForm: HouseFormModel): ObjectWorkbenchRoofProvenance {
  if (!houseForm.roofIntentAuthored) {
    return {
      form: 'legacy_pergola_inference',
      material: 'legacy_shared_value',
      primaryPitchDeg: 'legacy_shared_value',
      primaryFallDirection: 'default_fallback',
      ridgeAxis: 'default_fallback',
      openGableEndIds: 'default_fallback',
      appendage: 'default_fallback',
    };
  }
  const source = 'object_first_draft';
  return {
    form: source,
    material: source,
    primaryPitchDeg: source,
    primaryFallDirection: source,
    ridgeAxis: source,
    openGableEndIds: source,
    appendage: source,
  };
}

function buildRoofStatus(input: {
  activeModuleInput: Partial<CalculatorModuleInputs> | null | undefined;
  derivedFootprintPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
  houseForm: HouseFormModel | null;
}): ObjectWorkbenchRoofStatus | null {
  const houseForm = input.houseForm;
  if (!houseForm) return null;
  const intent = houseForm.roofIntent;
  const roofFootprintPolygon =
    input.derivedFootprintPolygon && input.derivedFootprintPolygon.length > 0
      ? input.derivedFootprintPolygon
      : houseForm.footprint.polygon;
  const footprint = localPolygonToGeometryPolygon(roofFootprintPolygon);
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: intent.form,
    footprint,
  });
  const geometryKind = deriveHouseRoofGeometryKind({
    roofForm: intent.form,
    footprint,
  });
  const eaveHeightMm = parseFiniteNumber(houseForm.eaveHeightM, 2.4) * 1000;
  const eaveOverhangMm = parseFiniteNumber(houseForm.eaveOverhangMm, 450);
  const pitchDeg = parseFiniteNumber(intent.primaryPitchDeg, intent.form === 'flat' ? 0 : 5);
  const appendageSupport = intent.appendage.enabled
    ? deriveHouseRoofAppendageSupport({
        sourceFootprint: footprint,
        eaveHeightMm,
        eaveOverhangMm,
        roofPitchDeg: pitchDeg,
        roofForm: intent.form,
        roofPrimaryFallDirection: intent.primaryFallDirection,
        roofRidgeAxis: intent.ridgeAxis,
      })
    : {
        supportedHostEdges: deriveHouseRoofAppendageSupportedHostEdges({
          footprint,
        }),
        blockedReasonsBySide: {},
      };
  const rawAppendageSupportedHostEdges = appendageSupport.supportedHostEdges.filter(isAttachmentSide);
  const appendageSupportedHostEdges =
    !houseForm.roofIntentAuthored && rawAppendageSupportedHostEdges.includes(houseForm.footprint.attachmentSide)
      ? [houseForm.footprint.attachmentSide]
      : rawAppendageSupportedHostEdges;
  const terminalEnds = deriveHouseGableTerminalEnds({
    footprint,
    ridgeAxis: intent.ridgeAxis,
  });
  const preferredRidgeAxis =
    intent.form === 'gable' || intent.form === 'hipped'
      ? resolvePreferredRidgeAxis({
          footprint,
          polygon: roofFootprintPolygon,
          fallback: intent.ridgeAxis,
        })
      : null;
  const validation = validateHouseRoofSelection({
    roofForm: intent.form,
    footprint,
    appendageEnabled: intent.appendage.enabled,
    roofPrimaryFallDirection: intent.primaryFallDirection,
    roofPrimaryFallDirectionExplicit: houseForm.roofIntentAuthored === true,
    preferredMonoFallDirection:
      intent.form === 'mono'
        ? preferredMonoFallDirectionForAttachmentSide(houseForm.footprint.attachmentSide)
        : null,
    enforcePreferredMonoFallDirection: activeAttachmentRequiresDrainEdge(input.activeModuleInput),
    roofRidgeAxis: intent.ridgeAxis,
    roofRidgeAxisExplicit: houseForm.roofIntentAuthored === true,
    preferredRidgeAxis,
    appendageHostEdge: intent.appendage.hostEdge,
    appendageSupport: {
      supportedHostEdges: appendageSupportedHostEdges,
      blockedReasonsBySide: appendageSupport.blockedReasonsBySide,
    },
  });
  const approximationReasons = houseForm.roofIntentAuthored ? [] : ['inferred_form'];
  const validationStatus =
    validation.status === 'invalid'
      ? 'invalid'
      : approximationReasons.length > 0
        ? 'approximate'
        : 'valid';

  return {
    form: intent.form,
    controls: getHouseRoofFormBehavior(intent.form).controls,
    selectedFormSupported: capabilities.selectedFormSupported,
    appendageSupported: appendageSupportedHostEdges.length > 0,
    appendageSupportedHostEdges,
    appendageSupportReason:
      validation.code === 'invalid_appendage_topology' || validation.code === 'invalid_appendage_host_edge'
        ? validation.message
        : null,
    terminalEnds: terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      isOpen: intent.openGableEndIds.includes(end.id),
    })),
    geometryKind,
    validationStatus,
    validationCode: validation.code,
    validationMessage: validation.message,
    approximationReasons,
    provenance: buildRoofProvenance(houseForm),
  };
}

function buildDeckStatuses(decks: DeckObjectModel[]): Record<string, ObjectWorkbenchDeckStatus> {
  return Object.fromEntries(
    decks.map((deck) => {
      const dragInteractionAvailable =
        deck.hostEdgeId === 'rear' ||
        deck.hostEdgeId === 'front' ||
        deck.hostEdgeId === 'left' ||
        deck.hostEdgeId === 'right';
      return [
        deck.id,
        {
          validation: {
            status: deck.validation?.status ?? 'valid',
            codes: deck.validation?.codes ?? [],
            messages: deck.validation?.messages ?? [],
            message: deck.validation?.message ?? null,
          },
          supportWarnings: {
            codes: deck.supportContext?.warningCodes ?? [],
            messages: deck.supportContext?.warningMessages ?? [],
          },
          interaction: resolveDeckInteractionCapability({
            deck,
            dragInteractionAvailable,
          }),
        },
      ];
    }),
  );
}

function buildOpeningStatuses(openings: OpeningObjectModel[]): Record<string, ObjectWorkbenchOpeningStatus> {
  return Object.fromEntries(
    openings.map((opening) => [
      opening.id,
      {
        validation: {
          status: opening.validation?.status ?? 'valid',
          codes: opening.validation?.codes ?? [],
          message: opening.validation?.message ?? null,
        },
      },
    ]),
  );
}

function resolvePergolaConnectionKind(pergola: PergolaObjectModel): ObjectWorkbenchPergolaConnectionKind {
  if (pergola.connectionKind) return pergola.connectionKind;
  if (pergola.strategy === 'none') return 'freestanding';
  return 'soffit';
}

function buildPergolaResolution(pergola: PergolaObjectModel, isFreestanding: boolean): ObjectWorkbenchPergolaStatus['resolution'] {
  if (isFreestanding) {
    return {
      status: 'resolved',
      message: null,
    };
  }
  if (pergola.attachmentEdgeId || pergola.attachmentZoneId) {
    return {
      status: 'resolved',
      message: null,
    };
  }
  return {
    status: 'unresolved',
    message: 'Select a resolved house edge or attachment zone for this pergola.',
  };
}

function buildPergolaStatuses(
  pergolas: PergolaObjectModel[],
): Record<string, ObjectWorkbenchPergolaStatus> {
  return Object.fromEntries(
    pergolas.map((pergola) => {
      const connectionKind = resolvePergolaConnectionKind(pergola);
      const isFreestanding = connectionKind === 'freestanding';
      return [
        pergola.id,
        {
          connectionKind,
          attachmentStrategy: pergola.strategy ?? 'auto',
          confidence: pergola.family === 'unknown' ? 'low' : 'high',
          isFreestanding,
          resolution: buildPergolaResolution(pergola, isFreestanding),
        },
      ];
    }),
  );
}

function resolveAttachmentStrategyZoneKinds(
  strategy: HouseFormModel['attachmentStrategy'] | null | undefined,
): Array<'wall' | 'soffit' | 'fascia' | 'roof_edge'> {
  switch (strategy) {
    case 'facade_ledger':
    case 'post_supported_tieback':
      return ['wall'];
    case 'fascia_under_gutter':
      return ['fascia'];
    case 'none':
      return [];
    case 'soffit_brackets':
    default:
      return ['soffit'];
  }
}

function resolveOpeningAttachmentSide(
  projectModel: WorkbenchProjectModel,
  opening: OpeningObjectModel,
): AttachmentSide | null {
  if (isAttachmentSide(opening.wallId)) return opening.wallId;
  if (opening.hostEdgeId) {
    const zoneSide =
      projectModel.houseAssembly?.derivedEnvelope?.attachmentZones.find((zone) => zone.hostEdgeId === opening.hostEdgeId)?.side ??
      null;
    if (isAttachmentSide(zoneSide)) return zoneSide;
  }
  return null;
}

function summarizeAttachmentZoneBlocks(projectModel: WorkbenchProjectModel): string {
  const houseForm = projectModel.houseAssembly?.houseForms[0] ?? null;
  const candidateKinds = resolveAttachmentStrategyZoneKinds(houseForm?.attachmentStrategy);
  if (!candidateKinds.length) return 'none';

  const blocked = new Set<string>();
  for (const opening of projectModel.openings) {
    if (opening.kind !== 'slider' && opening.kind !== 'stacker') continue;
    const side = resolveOpeningAttachmentSide(projectModel, opening);
    if (!side) continue;
    for (const kind of candidateKinds) {
      if (kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') {
        blocked.add(`${side} ${kind} (side_openings_block_roof_zone)`);
      }
    }
  }

  return blocked.size ? Array.from(blocked).join(' | ') : 'none';
}

export function buildObjectWorkbenchStatusFacade(input: {
  activeDeckId: string | null;
  activeModuleInput: Partial<CalculatorModuleInputs> | null | undefined;
  projectModel: WorkbenchProjectModel;
}): ObjectWorkbenchStatusFacade {
  const houseForm = input.projectModel.houseAssembly?.houseForms[0] ?? null;
  const warnings = buildMigrationWarnings(input.projectModel.warnings ?? []);
  const decks = input.projectModel.decks;
  const deckStatuses = buildDeckStatuses(decks);
  const activeHostSide = input.activeModuleInput
    ? resolveWorkbenchDeckSupportActiveSide(input.activeModuleInput)
    : null;
  const activeDeckSupport = activeHostSide
    ? buildWorkbenchDeckSupportDiagnostic({
        activeHostSide,
        decks,
      })
    : null;

  return {
    houseForm: {
      lowConfidence: warnings.length > 0,
      warnings,
      footprintPreset: houseForm?.footprint.preset ?? null,
      roofForm: houseForm?.roofIntent.form ?? null,
      defaultDeckHostEdgeId: houseForm?.footprint.attachmentSide ?? 'rear',
      attachmentZoneBlockedSummary: summarizeAttachmentZoneBlocks(input.projectModel),
      roof: buildRoofStatus({
        activeModuleInput: input.activeModuleInput,
        derivedFootprintPolygon: input.projectModel.houseAssembly?.derivedEnvelope?.footprint ?? null,
        houseForm,
      }),
    },
    deckStatuses,
    openingStatuses: buildOpeningStatuses(input.projectModel.openings),
    pergolaStatuses: buildPergolaStatuses(input.projectModel.pergolas),
    activeDeckSupport,
    activeDeckInteraction: input.activeDeckId ? deckStatuses[input.activeDeckId]?.interaction ?? null : null,
    deckSupportWarningCount: decks.reduce(
      (sum, deck) => sum + (deck.supportContext?.warningCodes.length ?? 0),
      0,
    ),
  };
}
