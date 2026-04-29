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
  buildDrawingWorkbenchRailModel,
  type DrawingWorkbenchRailModel,
} from './drawingWorkbenchRailModel';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';
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
    // P1.1 boundary: the hidden workbench store still consumes the house-first compatibility contract.
    // The object-first contracts in `objectFirstWorkbenchModel.ts` are canonical for future slices, but not wired here yet.
    projectModel: HouseFirstWorkbenchProjectModel;
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
    house: HouseModel | null;
    houseCount: number;
    decks: HouseModel['decks'];
    openings: HouseModel['openings'];
    activeDeckId: string | null;
    activeDeck: HouseModel['decks'][number] | null;
    activeOpeningId: string | null;
    activeOpening: HouseModel['openings'][number] | null;
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
  // P1.1 boundary: keep the active hidden workbench runtime on the compatibility `houseFirst` project model.
  // Object-first contract reconciliation happens in types/tests only during this slice.
  const projectModel = buildHouseFirstWorkbenchProjectModel({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const ui = normalizeDrawingWorkbenchUiState(input.ui, {
    moduleCount: drawingModules.length,
    houseFormIds: projectModel.house ? [projectModel.house.id] : [],
    pergolaIds: projectModel.pergolas.map((pergola) => pergola.id),
    deckIds: projectModel.house?.decks.map((deck) => deck.id) ?? [],
    openingIds: projectModel.house?.openings.map((opening) => opening.id) ?? [],
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
          sharedHouse: projectModel.house,
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
        house: projectModel.house,
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
  const activePergola =
    projectModel.pergolas.find((pergola) => pergola.id === ui.activePergolaId) ??
    projectModel.pergolas.find((pergola) => pergola.id === activeModule?.drawingModule.input.pergolaId) ??
    projectModel.pergolas[0] ??
    null;
  const decks = projectModel.house?.decks ?? [];
  const openings = projectModel.house?.openings ?? [];
  const activeDeck =
    ui.activeObjectFamily === 'decks'
      ? decks.find((deck) => deck.id === ui.activeObjectRef.objectId) ?? null
      : null;
  const activeOpening =
    ui.activeObjectFamily === 'openings'
      ? openings.find((opening) => opening.id === ui.activeObjectRef.objectId) ?? null
      : null;
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
    house: projectModel.house,
    pergolas: projectModel.pergolas,
    warnings: projectModel.warnings,
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
      house: projectModel.house,
      houseCount: projectModel.house ? 1 : 0,
      decks,
      openings,
      activeDeckId: activeDeck?.id ?? null,
      activeDeck,
      activeOpeningId: activeOpening?.id ?? null,
      activeOpening,
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
      roofForm: projectModel.house?.roof.form ?? null,
      roofReviewStatus:
        projectModel.house?.roof.validation.status === 'invalid'
          ? 'blocked'
          : projectModel.house?.roof.validation.status === 'approximate'
            ? 'approximate'
            : projectModel.house?.roof.validation.status === 'valid'
              ? 'ready'
              : 'none',
      roofValidationStatus: projectModel.house?.roof.validation.status ?? null,
      roofValidationCode: projectModel.house?.roof.validation.code ?? null,
      roofValidationMessage: projectModel.house?.roof.validation.message ?? null,
      roofApproximationReasons: projectModel.house?.roof.validation.approximationReasons ?? [],
      roofProvenance: projectModel.house?.roof.provenance ?? null,
      roofGeometryKind: projectModel.house?.roof.geometryKind ?? null,
      roofAppendageEnabled: Boolean(projectModel.house?.roof.appendage.enabled),
      roofAppendageSupportedHostEdges: projectModel.house?.roof.appendageSupportedHostEdges ?? [],
      roofAppendageSupportReason: projectModel.house?.roof.appendageSupportReason ?? null,
      roofAppendageStatus: projectModel.house?.roof.appendage.enabled
        ? projectModel.house?.roof.validation.code === 'invalid_appendage_topology' ||
          projectModel.house?.roof.validation.code === 'invalid_appendage_host_edge'
          ? 'invalid'
          : 'valid'
        : 'off',
      pergolas: projectModel.pergolas,
      activePergolaId: activePergola?.id ?? null,
      activePergola,
      migrationWarnings: projectModel.warnings,
      migrationWarningCount: projectModel.warnings.length,
      houseIsLowConfidence: Boolean(projectModel.house?.lowConfidence),
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
