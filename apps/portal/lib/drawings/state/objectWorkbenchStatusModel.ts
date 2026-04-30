import type { CalculatorHouseAttachmentStrategy, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { getHouseRoofFormBehavior } from '@sp/geometry';
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
  ObjectWorkbenchCompatibilityMigrationWarning,
  ObjectWorkbenchCompatibilityProjectModel,
} from './compat/objectWorkbenchCompatibilityModel';
import type { HouseFormRoofIntentModel } from './objectFirstWorkbenchModel';

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

export type ObjectWorkbenchRoofCompatibilityStatus = {
  form: HouseFormRoofIntentModel['form'];
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

export type ObjectWorkbenchHouseFormStatus = {
  lowConfidence: boolean;
  warnings: ObjectWorkbenchMigrationWarning[];
  footprintPreset: string | null;
  roofForm: string | null;
  defaultDeckHostEdgeId: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  attachmentZoneBlockedSummary: string;
  roof: ObjectWorkbenchRoofCompatibilityStatus | null;
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

function summarizeAttachmentZoneBlocks(
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel,
): string {
  const blocked = compatibilityProjectModel.house?.attachmentZoneDiagnostics.blocked ?? [];
  if (!blocked.length) return 'none';
  return Array.from(
    new Set(blocked.map((entry) => `${entry.side} ${entry.kind} (${entry.reason})`)),
  ).join(' | ');
}

function buildRoofStatus(
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel,
): ObjectWorkbenchRoofCompatibilityStatus | null {
  const roof = compatibilityProjectModel.house?.roof ?? null;
  if (!roof) return null;
  return {
    form: roof.form,
    controls: roof.capabilities.controls,
    selectedFormSupported: roof.capabilities.selectedFormSupported,
    appendageSupported: roof.capabilities.appendageSupported,
    appendageSupportedHostEdges: roof.appendageSupportedHostEdges,
    appendageSupportReason: roof.appendageSupportReason,
    terminalEnds: roof.terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      isOpen: end.isOpen,
    })),
    geometryKind: roof.geometryKind,
    validationStatus: roof.validation.status,
    validationCode: roof.validation.code,
    validationMessage: roof.validation.message,
    approximationReasons: roof.validation.approximationReasons ?? [],
    provenance: roof.provenance ?? {},
  };
}

function buildDeckStatuses(
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel,
): Record<string, ObjectWorkbenchDeckStatus> {
  return Object.fromEntries(
    (compatibilityProjectModel.house?.decks ?? []).map((deck) => {
      const dragInteractionAvailable =
        deck.hostEdgeId === 'rear' ||
        deck.hostEdgeId === 'front' ||
        deck.hostEdgeId === 'left' ||
        deck.hostEdgeId === 'right';
      return [
        deck.id,
        {
          validation: {
            status: deck.validation.status,
            codes: deck.validation.codes,
            messages: deck.validation.messages,
            message: deck.validation.message,
          },
          supportWarnings: {
            codes: deck.supportContext.warningCodes,
            messages: deck.supportContext.warningMessages,
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

function buildOpeningStatuses(
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel,
): Record<string, ObjectWorkbenchOpeningStatus> {
  return Object.fromEntries(
    (compatibilityProjectModel.house?.openings ?? []).map((opening) => [
      opening.id,
      {
        validation: {
          status: opening.validation.status,
          codes: opening.validation.codes,
          message: opening.validation.message,
        },
      },
    ]),
  );
}

function buildPergolaStatuses(
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel,
): Record<string, ObjectWorkbenchPergolaStatus> {
  return Object.fromEntries(
    (compatibilityProjectModel.pergolas ?? []).map((pergola) => [
      pergola.id,
      {
        connectionKind: pergola.attachment.kind,
        attachmentStrategy: pergola.attachment.strategy ?? 'auto',
        confidence: pergola.confidence,
        isFreestanding: pergola.attachment.kind === 'freestanding',
        resolution: {
          status: pergola.attachment.resolution.status,
          message: pergola.attachment.resolution.message,
        },
      },
    ]),
  );
}

export function buildObjectWorkbenchStatusFacade(input: {
  activeDeckId: string | null;
  activeModuleInput: Partial<CalculatorModuleInputs> | null | undefined;
  compatibilityProjectModel: ObjectWorkbenchCompatibilityProjectModel;
}): ObjectWorkbenchStatusFacade {
  const compatibilityHouse = input.compatibilityProjectModel.house;
  const warnings = buildMigrationWarnings(input.compatibilityProjectModel.warnings ?? []);
  const decks = compatibilityHouse?.decks ?? [];
  const deckStatuses = buildDeckStatuses(input.compatibilityProjectModel);
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
      lowConfidence: compatibilityHouse?.lowConfidence ?? warnings.length > 0,
      warnings,
      footprintPreset: compatibilityHouse?.footprint.preset ?? null,
      roofForm: compatibilityHouse?.roof.form ?? null,
      defaultDeckHostEdgeId: compatibilityHouse?.footprint.attachmentSide ?? 'rear',
      attachmentZoneBlockedSummary: summarizeAttachmentZoneBlocks(input.compatibilityProjectModel),
      roof: buildRoofStatus(input.compatibilityProjectModel),
    },
    deckStatuses,
    openingStatuses: buildOpeningStatuses(input.compatibilityProjectModel),
    pergolaStatuses: buildPergolaStatuses(input.compatibilityProjectModel),
    activeDeckSupport,
    activeDeckInteraction: input.activeDeckId ? deckStatuses[input.activeDeckId]?.interaction ?? null : null,
    deckSupportWarningCount: decks.reduce(
      (sum, deck) => sum + deck.supportContext.warningCodes.length,
      0,
    ),
  };
}
