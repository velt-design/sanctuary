import type { ModuleViewsStatus } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import {
  deriveWorkbenchGeometry,
  type WorkbenchPergolaRenderSource,
  type WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import { resolveWorkbenchGeometryModule } from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  resolveDeckInteractionCapability,
  type DeckInteractionCapability,
} from '@/lib/drawings/interactions/deckInteractionContract';
import { normalizeDrawingWorkbenchUiState, type DrawingWorkbenchUiState } from './drawingWorkbenchUiState';
import {
  resolveObjectFirstPergolaAttachment,
  resolveObjectFirstOpeningHost,
  type ObjectFirstPergolaAttachmentResolution,
  type ObjectFirstOpeningHostResolution,
} from './objectFirstDerivedHosting';
import {
  buildDrawingWorkbenchRailModel,
  type DrawingWorkbenchRailModel,
} from './drawingWorkbenchRailModel';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';
import {
  buildHouseFirstCompatibilityDraftFromObjectFirstDraft,
  buildObjectFirstWorkbenchProjectModel,
} from './objectFirstWorkbenchAdapter';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type {
  HouseFirstMigrationWarning,
  HouseFirstWorkbenchProjectModel,
  HouseModel,
  PergolaModel,
} from './houseFirstWorkbenchModel';
import type {
  HouseAssemblyModel,
  HouseFormModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';

export type DrawingWorkbenchModuleEntry = {
  id: string;
  label: string;
  drawingModule: EstimateDrawingModule;
  assemblyModel: DrawingAssemblyModel;
  planViewModel: PlanViewModel | null;
  geometryPlanViewModel: GeometryPlanViewModel | null;
  planRenderSource: WorkbenchPergolaRenderSource;
  planRenderStatus: WorkbenchPergolaRenderStatus;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

export type WorkbenchDeckInteractionDiagnostic = DeckInteractionCapability;

export type DrawingWorkbenchStore = {
  persisted: {
    snapshot: Record<string, unknown> | null;
    ignoreModuleResults: boolean;
    modules: DrawingWorkbenchModuleEntry[];
    projectModel: WorkbenchProjectModel;
    // Compatibility model is a derived projection for geometry/editor paths that have not moved to object-first yet.
    compatibilityProjectModel: HouseFirstWorkbenchProjectModel;
  };
  ui: DrawingWorkbenchUiState;
  derived: {
    moduleCount: number;
    activeModuleIndex: number;
    activeModule: DrawingWorkbenchModuleEntry | null;
    activeAssemblyModel: DrawingAssemblyModel | null;
    activePlanViewModel: PlanViewModel | null;
    activePlanModel: ModulePlanModel | null;
    activeSectionModel: ModuleSectionModel | null;
    activeModuleLabel: string;
    houseAssembly: HouseAssemblyModel | null;
    houseForms: HouseFormModel[];
    houseFormCount: number;
    activeHouseForm: HouseFormModel | null;
    house: HouseModel | null;
    houseCount: number;
    decks: HouseModel['decks'];
    openings: HouseModel['openings'];
    objectFirstOpenings: OpeningObjectModel[];
    activeDeckId: string | null;
    activeDeck: HouseModel['decks'][number] | null;
    activeOpeningId: string | null;
    activeOpening: HouseModel['openings'][number] | null;
    activeObjectFirstOpening: OpeningObjectModel | null;
    openingHostResolutions: Record<string, ObjectFirstOpeningHostResolution>;
    activeOpeningHostResolution: ObjectFirstOpeningHostResolution | null;
    unresolvedOpeningHostCount: number;
    railModel: DrawingWorkbenchRailModel;
    deckCount: number;
    openingCount: number;
    sliderOpeningCount: number;
    invalidOpeningCount: number;
    snappedPresetDeckCount: number;
    floatingPresetDeckCount: number;
    customDeckCount: number;
    invalidDeckCount: number;
    deckSupportWarningCount: number;
    activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
    activeDeckInteraction: WorkbenchDeckInteractionDiagnostic | null;
    roofForm: HouseModel['roof']['form'] | null;
    roofReviewStatus: 'ready' | 'approximate' | 'blocked' | 'none';
    roofValidationStatus: HouseModel['roof']['validation']['status'] | null;
    roofValidationCode: HouseModel['roof']['validation']['code'] | null;
    roofValidationMessage: string | null;
    roofApproximationReasons: NonNullable<HouseModel['roof']['validation']['approximationReasons']>;
    roofProvenance: HouseModel['roof']['provenance'] | null;
    roofGeometryKind: HouseModel['roof']['geometryKind'] | null;
    roofAppendageEnabled: boolean;
    roofAppendageStatus: 'valid' | 'invalid' | 'off';
    roofAppendageSupportedHostEdges: HouseModel['roof']['appendageSupportedHostEdges'];
    roofAppendageSupportReason: string | null;
    pergolas: PergolaModel[];
    activePergolaId: string | null;
    activePergola: PergolaModel | null;
    objectFirstPergolas: PergolaObjectModel[];
    activeObjectFirstPergola: PergolaObjectModel | null;
    pergolaAttachmentResolutions: Record<string, ObjectFirstPergolaAttachmentResolution>;
    activePergolaAttachmentResolution: ObjectFirstPergolaAttachmentResolution | null;
    unresolvedPergolaAttachmentCount: number;
    migrationWarnings: HouseFirstMigrationWarning[];
    migrationWarningCount: number;
    houseIsLowConfidence: boolean;
    status: ModuleViewsStatus;
  };
};

function buildDeckInteractionDiagnostic(
  deck: HouseModel['decks'][number] | null,
): WorkbenchDeckInteractionDiagnostic | null {
  if (!deck) return null;
  const dragInteractionAvailable =
    deck.hostEdgeId === 'rear' ||
    deck.hostEdgeId === 'front' ||
    deck.hostEdgeId === 'left' ||
    deck.hostEdgeId === 'right';

  return resolveDeckInteractionCapability({
    deck,
    dragInteractionAvailable,
  });
}

export function buildDrawingWorkbenchStore(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ui: DrawingWorkbenchUiState;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
}): DrawingWorkbenchStore {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const hasObjectFirstDraft = input.draft?.objectFirst !== undefined && input.draft.objectFirst !== null;
  const compatibilityDraft =
    hasObjectFirstDraft && input.draft
      ? {
          ...input.draft,
          houseFirst: buildHouseFirstCompatibilityDraftFromObjectFirstDraft(
            input.draft.objectFirst,
          ),
        }
      : input.draft;
  const compatibilityProjectModel = buildHouseFirstWorkbenchProjectModel({
    snapshot: input.snapshot,
    draft: compatibilityDraft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const projectModel = buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
    objectFirstDraft: input.draft?.objectFirst,
  });
  const houseForms = projectModel.houseAssembly?.houseForms ?? [];
  const ui = normalizeDrawingWorkbenchUiState(input.ui, {
    moduleCount: drawingModules.length,
    houseFormIds: houseForms.map((houseForm) => houseForm.id),
    pergolaIds: projectModel.pergolas.map((pergola) => pergola.id),
    deckIds: projectModel.decks.map((deck) => deck.id),
    openingIds: projectModel.openings.map((opening) => opening.id),
  });
  const modules = drawingModules.map((drawingModule, index) => {
    const label = input.moduleLabels?.[index] ?? drawingModule.label;
    const geometryModule = coerceHiddenWorkbenchGableBaseline(drawingModule.input);
    const resolved = resolveWorkbenchGeometryModule({
      snapshot: input.snapshot,
      draft: input.draft,
      moduleIndex: index,
      ignoreModuleResults: input.ignoreModuleResults,
    });
    const resolvedDrawingModule: EstimateDrawingModule = {
      ...drawingModule,
      result: resolved.ok ? resolved.moduleResult : null,
    };
    const derivation = resolved.ok
      ? deriveWorkbenchGeometry({
          projectId: 'hidden-workbench-project',
          estimateId: 'hidden-workbench-estimate',
          moduleId: drawingModule.id,
          module: geometryModule,
          result: resolved.moduleResult,
          sharedHouse: compatibilityProjectModel.house,
          fallbackPlanModel: resolvedDrawingModule.planModel,
          fallbackSectionModel: resolvedDrawingModule.sectionModel,
        })
      : null;
    const planModel =
      derivation?.kind === 'geometry'
        ? derivation.planModel
        : derivation?.kind === 'legacy_unsupported_family'
          ? derivation.planModel
          : null;
    const sectionModel =
      derivation?.kind === 'geometry'
        ? derivation.sectionModel
        : derivation?.kind === 'legacy_unsupported_family'
          ? derivation.sectionModel
          : null;
    const geometryPlanViewModel = derivation?.kind === 'geometry' ? derivation.geometryPlan : null;
    const planRenderSource = derivation?.renderSource ?? 'legacy';
    const planRenderStatus = derivation?.renderStatus ?? 'invalid_geometry';
    const assemblyModel = buildAssemblyModel({
      id: drawingModule.id,
      label,
      moduleIndex: index,
      moduleInput: geometryModule,
      moduleResult: resolvedDrawingModule.result,
      planModel,
      sectionModel,
    });

    return {
      id: drawingModule.id,
      label,
      drawingModule: resolvedDrawingModule,
      assemblyModel,
      planViewModel: buildPlanViewModel({
        moduleId: drawingModule.id,
        moduleLabel: label,
        planModel,
        geometryPlan: geometryPlanViewModel,
        pergolaRenderSource: planRenderSource,
        pergolaRenderStatus: planRenderStatus,
        canEditHouseFootprint: assemblyModel.capabilities.canEditHouseFootprint,
        house: compatibilityProjectModel.house,
        activeHouseSelection: ui.activeHouseSelection,
        includeHouseFirstOverlay: ui.activeRailTab !== 'pergolas',
        moduleLengthM: geometryModule.lengthM,
        moduleProjectionM: geometryModule.projectionM,
      }),
      geometryPlanViewModel,
      planRenderSource,
      planRenderStatus,
      planModel,
      sectionModel,
    };
  });

  const activeModule = modules[ui.activeModuleIndex] ?? null;
  const objectFirstPergolas = projectModel.pergolas;
  const activePergola =
    compatibilityProjectModel.pergolas.find((pergola) => pergola.id === ui.activePergolaId) ??
    compatibilityProjectModel.pergolas.find((pergola) => pergola.id === activeModule?.drawingModule.input.pergolaId) ??
    compatibilityProjectModel.pergolas[0] ??
    null;
  const activeObjectFirstPergola =
    ui.activeObjectFamily === 'pergolas'
      ? objectFirstPergolas.find((pergola) => pergola.id === ui.activeObjectRef.objectId) ?? null
      : activePergola
        ? objectFirstPergolas.find((pergola) => pergola.id === activePergola.id) ?? null
        : null;
  const activeHouseForm =
    ui.activeObjectFamily === 'house_forms'
      ? houseForms.find((houseForm) => houseForm.id === ui.activeObjectRef.objectId) ?? null
      : null;
  const decks = compatibilityProjectModel.house?.decks ?? [];
  const openings = compatibilityProjectModel.house?.openings ?? [];
  const objectFirstOpenings = projectModel.openings;
  const activeDeck =
    ui.activeObjectFamily === 'decks'
      ? decks.find((deck) => deck.id === ui.activeObjectRef.objectId) ?? null
      : null;
  const activeOpening =
    ui.activeObjectFamily === 'openings'
      ? openings.find((opening) => opening.id === ui.activeObjectRef.objectId) ?? null
      : null;
  const activeObjectFirstOpening =
    ui.activeObjectFamily === 'openings'
      ? objectFirstOpenings.find((opening) => opening.id === ui.activeObjectRef.objectId) ?? null
      : null;
  const openingHostResolutions = Object.fromEntries(
    objectFirstOpenings.map((opening) => [
      opening.id,
      resolveObjectFirstOpeningHost({
        houseAssembly: projectModel.houseAssembly,
        opening,
      }),
    ]),
  ) as Record<string, ObjectFirstOpeningHostResolution>;
  const activeOpeningHostResolution = activeObjectFirstOpening
    ? openingHostResolutions[activeObjectFirstOpening.id] ?? null
    : null;
  const unresolvedOpeningHostCount = Object.values(openingHostResolutions).filter(
    (resolution) => resolution.status === 'unresolved',
  ).length;
  const pergolaAttachmentResolutions = Object.fromEntries(
    objectFirstPergolas.map((pergola) => [
      pergola.id,
      resolveObjectFirstPergolaAttachment({
        houseAssembly: projectModel.houseAssembly,
        pergola,
      }),
    ]),
  ) as Record<string, ObjectFirstPergolaAttachmentResolution>;
  const activePergolaAttachmentResolution = activeObjectFirstPergola
    ? pergolaAttachmentResolutions[activeObjectFirstPergola.id] ?? null
    : null;
  const compatibilityPergolasById = new Map(compatibilityProjectModel.pergolas.map((pergola) => [pergola.id, pergola]));
  const unresolvedPergolaAttachmentCount = Object.entries(pergolaAttachmentResolutions).filter(
    ([pergolaId, resolution]) =>
      resolution.status === 'unresolved' &&
      compatibilityPergolasById.get(pergolaId)?.attachment.kind !== 'freestanding',
  ).length;
  const deckSupportWarningCount = decks.reduce(
    (sum, deck) => sum + deck.supportContext.warningCodes.length,
    0,
  );
  const activeDeckSupport = activeModule
    ? buildWorkbenchDeckSupportDiagnostic({
        activeHostSide: resolveWorkbenchDeckSupportActiveSide(activeModule.assemblyModel.moduleInput),
        decks,
      })
    : null;
  const activeDeckInteraction = buildDeckInteractionDiagnostic(activeDeck);
  const railModel = buildDrawingWorkbenchRailModel({
    activeRailTab: ui.activeRailTab,
    activeObjectFamily: ui.activeObjectFamily,
    activeObjectRef: ui.activeObjectRef,
    house: compatibilityProjectModel.house,
    openings: objectFirstOpenings,
    openingHostResolutions,
    pergolas: objectFirstPergolas,
    compatibilityPergolas: compatibilityProjectModel.pergolas,
    pergolaAttachmentResolutions,
    warnings: compatibilityProjectModel.warnings,
    modules: modules.map((module) => ({
      pergolaId: module.drawingModule.input.pergolaId,
      planRenderStatus: module.planRenderStatus,
    })),
  });

  return {
    persisted: {
      snapshot: effectiveSnapshot,
      ignoreModuleResults: Boolean(input.ignoreModuleResults),
      modules,
      projectModel,
      compatibilityProjectModel,
    },
    ui,
    derived: {
      moduleCount: modules.length,
      activeModuleIndex: ui.activeModuleIndex,
      activeModule,
      activeAssemblyModel: activeModule?.assemblyModel ?? null,
      activePlanViewModel: activeModule?.planViewModel ?? null,
      activePlanModel: activeModule?.planModel ?? null,
      activeSectionModel: activeModule?.sectionModel ?? null,
      activeModuleLabel: activeModule?.label ?? 'Module',
      houseAssembly: projectModel.houseAssembly,
      houseForms,
      houseFormCount: houseForms.length,
      activeHouseForm,
      house: compatibilityProjectModel.house,
      houseCount: compatibilityProjectModel.house ? 1 : 0,
      decks,
      openings,
      objectFirstOpenings,
      activeDeckId: activeDeck?.id ?? null,
      activeDeck,
      activeOpeningId: activeOpening?.id ?? null,
      activeOpening,
      activeObjectFirstOpening,
      openingHostResolutions,
      activeOpeningHostResolution,
      unresolvedOpeningHostCount,
      railModel,
      deckCount: decks.length,
      openingCount: openings.length,
      sliderOpeningCount: openings.filter((opening) => opening.kind === 'slider').length,
      invalidOpeningCount: openings.filter((opening) => opening.validation.status === 'invalid').length,
      snappedPresetDeckCount: decks.filter((deck) => deck.shape === 'preset' && deck.isAttached).length,
      floatingPresetDeckCount: decks.filter((deck) => deck.shape === 'preset' && !deck.isAttached).length,
      customDeckCount: decks.filter((deck) => deck.shape === 'custom').length,
      invalidDeckCount: decks.filter((deck) => deck.validation.status === 'invalid').length,
      deckSupportWarningCount,
      activeDeckSupport,
      activeDeckInteraction,
      roofForm: compatibilityProjectModel.house?.roof.form ?? null,
      roofReviewStatus:
        compatibilityProjectModel.house?.roof.validation.status === 'invalid'
          ? 'blocked'
          : compatibilityProjectModel.house?.roof.validation.status === 'approximate'
            ? 'approximate'
            : compatibilityProjectModel.house?.roof.validation.status === 'valid'
              ? 'ready'
              : 'none',
      roofValidationStatus: compatibilityProjectModel.house?.roof.validation.status ?? null,
      roofValidationCode: compatibilityProjectModel.house?.roof.validation.code ?? null,
      roofValidationMessage: compatibilityProjectModel.house?.roof.validation.message ?? null,
      roofApproximationReasons: compatibilityProjectModel.house?.roof.validation.approximationReasons ?? [],
      roofProvenance: compatibilityProjectModel.house?.roof.provenance ?? null,
      roofGeometryKind: compatibilityProjectModel.house?.roof.geometryKind ?? null,
      roofAppendageEnabled: Boolean(compatibilityProjectModel.house?.roof.appendage.enabled),
      roofAppendageSupportedHostEdges: compatibilityProjectModel.house?.roof.appendageSupportedHostEdges ?? [],
      roofAppendageSupportReason: compatibilityProjectModel.house?.roof.appendageSupportReason ?? null,
      roofAppendageStatus: compatibilityProjectModel.house?.roof.appendage.enabled
        ? compatibilityProjectModel.house?.roof.validation.code === 'invalid_appendage_topology' ||
          compatibilityProjectModel.house?.roof.validation.code === 'invalid_appendage_host_edge'
          ? 'invalid'
          : 'valid'
        : 'off',
      pergolas: compatibilityProjectModel.pergolas,
      activePergolaId: activePergola?.id ?? null,
      activePergola,
      objectFirstPergolas,
      activeObjectFirstPergola,
      pergolaAttachmentResolutions,
      activePergolaAttachmentResolution,
      unresolvedPergolaAttachmentCount,
      migrationWarnings: compatibilityProjectModel.warnings,
      migrationWarningCount: compatibilityProjectModel.warnings.length,
      houseIsLowConfidence: Boolean(compatibilityProjectModel.house?.lowConfidence),
      status:
        ui.activeView === 'section'
          ? activeModule?.sectionModel
            ? 'ready'
            : 'empty'
          : activeModule?.planModel
            ? 'ready'
            : 'empty',
    },
  };
}
