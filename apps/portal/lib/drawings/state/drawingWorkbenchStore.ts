import type { ModuleViewsStatus } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import type {
  ObjectWorkbenchPergolaRenderSource,
  ObjectWorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import { buildObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { DeckInteractionCapability } from '@/lib/drawings/interactions/deckInteractionContract';
import {
  deriveDrawingWorkbenchCompatibilitySelection,
  normalizeDrawingWorkbenchUiState,
  type DrawingWorkbenchUiState,
} from './drawingWorkbenchUiState';
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
import { buildObjectWorkbenchCompatibilityProjectModel } from './compat/objectWorkbenchCompatibilityModel';
import {
  buildObjectFirstWorkbenchProjectModel,
} from './objectFirstWorkbenchAdapter';
import type { WorkbenchDeckSupportDiagnostic } from './deckSupportDiagnostics';
import {
  buildObjectWorkbenchInspectorFacade,
  type ObjectWorkbenchInspectorFacade,
} from './objectWorkbenchInspectorModel';
import { buildObjectWorkbenchStatusFacade } from './objectWorkbenchStatusModel';
import {
  appendWorkbenchTrustIssues,
  buildWorkbenchSolvedModel,
  resolveWorkbenchTrustGate,
  type WorkbenchGeometryIdentity,
  type WorkbenchSolvedModel,
  type WorkbenchSolvedModule,
  type WorkbenchTrustGateModel,
  type WorkbenchTrustStatus,
  type WorkbenchTrustStatusKind,
} from './workbenchSolvedModel';
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
  planRenderSource: ObjectWorkbenchPergolaRenderSource;
  planRenderStatus: ObjectWorkbenchPergolaRenderStatus;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
  solution: WorkbenchSolvedModule;
};

export type WorkbenchDeckInteractionDiagnostic = DeckInteractionCapability;

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
    solvedModel: WorkbenchSolvedModel;
    activeSolution: WorkbenchSolvedModule | null;
    activeTrust: WorkbenchTrustStatus;
    activeTrustGate: WorkbenchTrustGateModel;
    exportReadiness: WorkbenchTrustGateModel;
    reviewReadiness: WorkbenchTrustGateModel;
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
    objectFirstOpenings: OpeningObjectModel[];
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
    objectWorkbench: ObjectWorkbenchInspectorFacade;
    objectFirstPergolas: PergolaObjectModel[];
    activeObjectFirstPergola: PergolaObjectModel | null;
    pergolaAttachmentResolutions: Record<string, ObjectFirstPergolaAttachmentResolution>;
    activePergolaAttachmentResolution: ObjectFirstPergolaAttachmentResolution | null;
    unresolvedPergolaAttachmentCount: number;
    status: ModuleViewsStatus;
  };
};

export function buildDrawingWorkbenchStore(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ui: DrawingWorkbenchUiState;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
  geometryIdentity?: WorkbenchGeometryIdentity | null;
}): DrawingWorkbenchStore {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const projectModel = buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
    objectFirstDraft: input.draft?.objectFirst,
  });
  const houseForms = projectModel.houseAssembly?.houseForms ?? [];
  const objectFirstDecks = projectModel.decks;
  const objectFirstOpenings = projectModel.openings;
  const objectFirstPergolas = projectModel.pergolas;
  const ui = normalizeDrawingWorkbenchUiState(input.ui, {
    moduleCount: drawingModules.length,
    houseFormIds: houseForms.map((houseForm) => houseForm.id),
    pergolaIds: objectFirstPergolas.map((pergola) => pergola.id),
    deckIds: objectFirstDecks.map((deck) => deck.id),
    openingIds: objectFirstOpenings.map((opening) => opening.id),
  });
  const compatibilitySelection = deriveDrawingWorkbenchCompatibilitySelection(ui);
  const overlayHouseForm =
    ui.activeObjectFamily === 'house_forms'
      ? houseForms.find((houseForm) => houseForm.id === ui.activeObjectRef.objectId) ?? houseForms[0] ?? null
      : houseForms[0] ?? null;
  const objectWorkbenchOverlayStatus = buildObjectWorkbenchStatusFacade({
    activeDeckId: null,
    activeModuleInput: undefined,
    compatibilityProjectModel,
  });
  const objectWorkbenchGeometryContext = buildObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
    projectModel,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const solvedModel = buildWorkbenchSolvedModel({
    snapshot: input.snapshot,
    draft: input.draft,
    ignoreModuleResults: input.ignoreModuleResults,
    moduleLabels: input.moduleLabels,
    activeModuleIndex: ui.activeModuleIndex,
    geometryIdentity: input.geometryIdentity,
    projectModel,
    drawingModules,
    objectWorkbenchGeometryContext,
  });
  const modules = solvedModel.modules.map((solution) => {
    const label = solution.label;
    const geometryModule = solution.moduleInput;
    const resolvedDrawingModule: EstimateDrawingModule = solution.drawingModule;
    const planModel = solution.planModel;
    const sectionModel = solution.sectionModel;
    const geometryPlanViewModel = solution.geometryPlan;
    const planRenderSource = solution.renderSource;
    const planRenderStatus = solution.renderStatus;
    const assemblyModel = buildAssemblyModel({
      id: solution.id,
      label,
      moduleIndex: solution.index,
      moduleInput: geometryModule,
      moduleResult: resolvedDrawingModule.result,
      planModel,
      sectionModel,
    });

    return {
      id: solution.id,
      label,
      drawingModule: resolvedDrawingModule,
      assemblyModel,
      planViewModel: buildPlanViewModel({
        moduleId: solution.id,
        moduleLabel: label,
        planModel,
        geometryPlan: geometryPlanViewModel,
        pergolaRenderSource: planRenderSource,
        pergolaRenderStatus: planRenderStatus,
        canEditHouseFootprint: assemblyModel.capabilities.canEditHouseFootprint,
        objectWorkbenchOverlayInput: ui.activeRailTab !== 'pergolas'
          ? {
              houseAssembly: projectModel.houseAssembly,
              houseForm: overlayHouseForm,
              decks: objectFirstDecks,
              openings: objectFirstOpenings,
              selection: compatibilitySelection.activeHouseSelection,
              moduleLengthM: geometryModule.lengthM,
              moduleProjectionM: geometryModule.projectionM,
              geometryHouseContext: planModel?.houseContext ?? null,
              status: objectWorkbenchOverlayStatus,
            }
          : null,
      }),
      geometryPlanViewModel,
      planRenderSource,
      planRenderStatus,
      planModel,
      sectionModel,
      solution,
    };
  });

  const activeModule = modules[ui.activeModuleIndex] ?? null;
  const activeSolution = solvedModel.activeModule;
  const activePergola =
    objectFirstPergolas.find((pergola) => pergola.id === compatibilitySelection.activePergolaId) ??
    objectFirstPergolas.find((pergola) => pergola.id === activeModule?.drawingModule.input.pergolaId) ??
    objectFirstPergolas[0] ??
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
  const activeObjectFirstDeck =
    ui.activeObjectFamily === 'decks'
      ? objectFirstDecks.find((deck) => deck.id === ui.activeObjectRef.objectId) ?? null
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
  const objectWorkbenchStatus = buildObjectWorkbenchStatusFacade({
    activeDeckId: activeObjectFirstDeck?.id ?? null,
    activeModuleInput: activeModule?.assemblyModel.moduleInput,
    compatibilityProjectModel,
  });
  const unresolvedPergolaAttachmentCount = Object.entries(pergolaAttachmentResolutions).filter(
    ([pergolaId, resolution]) =>
      resolution.status === 'unresolved' &&
      objectWorkbenchStatus.pergolaStatuses[pergolaId]?.connectionKind !== 'freestanding',
  ).length;
  const additionalTrustIssues: WorkbenchTrustStatusKind[] = [];
  if (unresolvedOpeningHostCount > 0 || unresolvedPergolaAttachmentCount > 0) {
    additionalTrustIssues.push('unresolved_host');
  }
  if (
    objectWorkbenchStatus.houseForm.roof?.validationStatus === 'approximate' ||
    objectWorkbenchStatus.houseForm.lowConfidence ||
    objectWorkbenchStatus.houseForm.warnings.length > 0
  ) {
    additionalTrustIssues.push('approximate');
  }
  if (
    Object.values(objectWorkbenchStatus.deckStatuses).some((deck) => deck.validation.status === 'invalid') ||
    Object.values(objectWorkbenchStatus.openingStatuses).some(
      (opening) =>
        opening.validation.status === 'invalid' &&
        opening.validation.codes.some((code) => code !== 'missing_host_wall'),
    ) ||
    objectWorkbenchStatus.houseForm.roof?.validationStatus === 'invalid'
  ) {
    additionalTrustIssues.push('invalid_geometry');
  }
  const activeTrust = appendWorkbenchTrustIssues(
    activeSolution?.trust ?? solvedModel.trust,
    additionalTrustIssues,
  );
  const activeTrustGate = resolveWorkbenchTrustGate(activeTrust);
  const objectWorkbench = buildObjectWorkbenchInspectorFacade({
    activeObjectRef: ui.activeObjectRef,
    activeTrust,
    houseAssembly: projectModel.houseAssembly,
    openingHostResolutions: new Map(Object.entries(openingHostResolutions)),
    pergolaAttachmentResolutions: new Map(Object.entries(pergolaAttachmentResolutions)),
    projectModel,
    status: objectWorkbenchStatus,
  });
  const railModel = buildDrawingWorkbenchRailModel({
    activeRailTab: ui.activeRailTab,
    activeObjectFamily: ui.activeObjectFamily,
    activeObjectRef: ui.activeObjectRef,
    houseForms,
    decks: objectFirstDecks,
    openings: objectFirstOpenings,
    openingHostResolutions,
    pergolas: objectFirstPergolas,
    pergolaAttachmentResolutions,
    modules: modules.map((module) => ({
      pergolaId: module.drawingModule.input.pergolaId,
      planRenderStatus: module.planRenderStatus,
      trust: module.solution.trust,
    })),
    activeTrust,
    status: objectWorkbenchStatus,
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
      solvedModel,
      activeSolution,
      activeTrust,
      activeTrustGate,
      exportReadiness: activeTrustGate,
      reviewReadiness: activeTrustGate,
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
      objectFirstOpenings,
      activeObjectFirstOpening,
      openingHostResolutions,
      activeOpeningHostResolution,
      unresolvedOpeningHostCount,
      railModel,
      deckCount: objectWorkbench.diagnostics.deckCount,
      openingCount: objectWorkbench.diagnostics.openingCount,
      sliderOpeningCount: objectWorkbench.diagnostics.sliderOpeningCount,
      invalidOpeningCount: objectWorkbench.diagnostics.invalidOpeningCount,
      snappedPresetDeckCount: objectWorkbench.diagnostics.snappedPresetDeckCount,
      floatingPresetDeckCount: objectWorkbench.diagnostics.floatingPresetDeckCount,
      customDeckCount: objectWorkbench.diagnostics.customDeckCount,
      invalidDeckCount: objectWorkbench.diagnostics.invalidDeckCount,
      deckSupportWarningCount: objectWorkbenchStatus.deckSupportWarningCount,
      activeDeckSupport: objectWorkbenchStatus.activeDeckSupport,
      activeDeckInteraction: objectWorkbenchStatus.activeDeckInteraction,
      objectWorkbench,
      objectFirstPergolas,
      activeObjectFirstPergola,
      pergolaAttachmentResolutions,
      activePergolaAttachmentResolution,
      unresolvedPergolaAttachmentCount,
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
