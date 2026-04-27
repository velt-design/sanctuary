import type { ModuleViewsStatus } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  buildPlanViewModel as buildGeometryPlanViewModel,
  buildSectionViewModel as buildGeometrySectionViewModel,
  normalizeGeometryConfig,
  solveAssembly3D,
} from '@sp/geometry';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import { buildRawGeometryModuleInput } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import { resolveWorkbenchGeometryModule } from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildLegacyModulePlanModelFromGeometry } from '@/lib/drawings/views/plan/buildLegacyModulePlanModelFromGeometry';
import { buildLegacyModuleSectionModelFromGeometry } from '@/lib/drawings/views/section/buildLegacyModuleSectionModelFromGeometry';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { normalizeDrawingWorkbenchUiState, type DrawingWorkbenchUiState } from './drawingWorkbenchUiState';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type {
  HouseFirstMigrationWarning,
  HouseModel,
  PergolaModel,
  WorkbenchProjectModel,
} from './houseFirstWorkbenchModel';
import { resolveDeckPlacementMode } from './houseFirstWorkbenchModel';

export type DrawingWorkbenchModuleEntry = {
  id: string;
  label: string;
  drawingModule: EstimateDrawingModule;
  assemblyModel: DrawingAssemblyModel;
  planViewModel: PlanViewModel | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

export type WorkbenchDeckInteractionDiagnostic = {
  selectedDeckType: 'none' | 'preset_snapped' | 'preset_floating' | 'custom_outline' | 'preset_unresolved';
  dragEligible: boolean;
  dragReason: string | null;
  hostEdgeResolvable: boolean;
  relationshipDimensionsAvailable: boolean;
};

export type DrawingWorkbenchStore = {
  persisted: {
    snapshot: Record<string, unknown> | null;
    ignoreModuleResults: boolean;
    modules: DrawingWorkbenchModuleEntry[];
    projectModel: WorkbenchProjectModel;
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
    roofValidationStatus: HouseModel['roof']['validation']['status'] | null;
    roofValidationCode: HouseModel['roof']['validation']['code'] | null;
    roofValidationMessage: string | null;
    roofAppendageEnabled: boolean;
    roofAppendageStatus: 'valid' | 'invalid' | 'off';
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
  const hostEdgeResolvable =
    deck.hostEdgeId === 'rear' ||
    deck.hostEdgeId === 'front' ||
    deck.hostEdgeId === 'left' ||
    deck.hostEdgeId === 'right';

  if (deck.shape === 'custom') {
    return {
      selectedDeckType: 'custom_outline',
      dragEligible: false,
      dragReason: 'Custom deck dragging is deferred. Use dimensions or redraw the outline.',
      hostEdgeResolvable,
      relationshipDimensionsAvailable: false,
    };
  }

  if (!hostEdgeResolvable || !deck.presetRect) {
    return {
      selectedDeckType: 'preset_unresolved',
      dragEligible: false,
      dragReason: 'This preset deck needs a resolvable house reference edge before drag and relationship dims are available.',
      hostEdgeResolvable,
      relationshipDimensionsAvailable: false,
    };
  }

  return {
    selectedDeckType: resolveDeckPlacementMode(deck.isAttached) === 'snapped' ? 'preset_snapped' : 'preset_floating',
    dragEligible: true,
    dragReason: 'Drag the selected deck body to move it near the house edge or into floating placement, or click dimensions to edit.',
    hostEdgeResolvable: true,
    relationshipDimensionsAvailable: true,
  };
}

function buildGeometryDerivedModels(input: {
  drawingModule: EstimateDrawingModule;
  moduleInput: EstimateDrawingModule['input'];
  moduleResult: EstimateDrawingModule['result'];
  sharedHouse: HouseModel | null;
}): {
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
} {
  const rawInput = buildRawGeometryModuleInput({
    projectId: 'hidden-workbench-project',
    estimateId: 'hidden-workbench-estimate',
    designRequestId: null,
    moduleId: input.drawingModule.id,
    module: input.moduleInput,
    result: input.moduleResult,
    sharedHouse: input.sharedHouse,
  });
  const normalized = normalizeGeometryConfig(rawInput);
  if (!normalized.ok) {
    return {
      planModel: null,
      sectionModel: null,
    };
  }

  const solved = solveAssembly3D(normalized.value);
  if (!solved.ok) {
    return {
      planModel: null,
      sectionModel: null,
    };
  }

  const geometryPlan = buildGeometryPlanViewModel(solved.value);
  const geometrySection = buildGeometrySectionViewModel(solved.value);
  return {
    planModel: buildLegacyModulePlanModelFromGeometry({
      geometryPlan,
      module: input.moduleInput,
      fallbackMetadata: input.drawingModule.planModel,
    }),
    sectionModel: buildLegacyModuleSectionModelFromGeometry({
      geometrySection,
      module: input.moduleInput,
      fallbackMetadata: input.drawingModule.sectionModel,
    }),
  };
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
  const projectModel = buildHouseFirstWorkbenchProjectModel({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const ui = normalizeDrawingWorkbenchUiState(input.ui, {
    moduleCount: drawingModules.length,
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
    const geometryModels = resolved.ok
        ? buildGeometryDerivedModels({
          drawingModule: resolvedDrawingModule,
          moduleInput: geometryModule,
          moduleResult: resolved.moduleResult,
          sharedHouse: projectModel.house,
        })
      : {
          planModel: null,
          sectionModel: null,
        };
    const assemblyModel = buildAssemblyModel({
      id: drawingModule.id,
      label,
      moduleIndex: index,
      moduleInput: geometryModule,
      moduleResult: resolvedDrawingModule.result,
      planModel: geometryModels.planModel,
      sectionModel: geometryModels.sectionModel,
    });

    return {
      id: drawingModule.id,
      label,
      drawingModule: resolvedDrawingModule,
      assemblyModel,
      planViewModel: buildPlanViewModel({
        moduleId: drawingModule.id,
        moduleLabel: label,
        planModel: geometryModels.planModel,
        canEditHouseFootprint: assemblyModel.capabilities.canEditHouseFootprint,
        house: projectModel.house,
        activeHouseSelection: ui.activeHouseSelection,
        includeHouseFirstOverlay: ui.workbenchMode === 'house',
        moduleLengthM: geometryModule.lengthM,
        moduleProjectionM: geometryModule.projectionM,
      }),
      planModel: geometryModels.planModel,
      sectionModel: geometryModels.sectionModel,
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
    ui.workbenchMode === 'house' && ui.activeHouseSelection.kind === 'deck'
      ? decks.find((deck) => deck.id === ui.activeHouseSelection.targetId) ?? null
      : null;
  const activeOpening =
    ui.workbenchMode === 'house' && ui.activeHouseSelection.kind === 'opening'
      ? openings.find((opening) => opening.id === ui.activeHouseSelection.targetId) ?? null
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
      roofValidationStatus: projectModel.house?.roof.validation.status ?? null,
      roofValidationCode: projectModel.house?.roof.validation.code ?? null,
      roofValidationMessage: projectModel.house?.roof.validation.message ?? null,
      roofAppendageEnabled: Boolean(projectModel.house?.roof.appendage.enabled),
      roofAppendageStatus: projectModel.house?.roof.appendage.enabled
        ? projectModel.house?.roof.validation.code === 'invalid_appendage'
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
