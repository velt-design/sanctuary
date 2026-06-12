import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { DeckInteractionCapability } from '@/lib/drawings/interactions/deckInteractionContract';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import {
  buildWorkbenchDrawingSurfaceGeometry,
  type WorkbenchDrawingSurfaceGeometry,
} from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import {
  normalizeDrawingWorkbenchUiState,
  type DrawingWorkbenchUiState,
} from './drawingWorkbenchUiState';
import {
  resolveObjectFirstOpeningHost,
  resolveObjectFirstPergolaAttachment,
  type ObjectFirstOpeningHostResolution,
  type ObjectFirstPergolaAttachmentResolution,
} from './objectFirstDerivedHosting';
import {
  buildDrawingWorkbenchRailModel,
  type DrawingWorkbenchRailModel,
} from './drawingWorkbenchRailModel';
import type { WorkbenchDeckSupportDiagnostic } from './deckSupportDiagnostics';
import {
  buildObjectWorkbenchInspectorFacade,
  type ObjectWorkbenchInspectorFacade,
} from './objectWorkbenchInspectorModel';
import { buildObjectWorkbenchStatusFacade } from './objectWorkbenchStatusModel';
import {
  EMPTY_WORKBENCH_PROJECT_MODEL,
  buildWorkbenchProjectModelFromObjectFirstDraft,
  type ObjectFirstWorkbenchDraftVNext,
  type HouseAssemblyModel,
  type HouseFormModel,
  type OpeningObjectModel,
  type PergolaObjectModel,
  type WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';
import {
  appendWorkbenchTrustIssues,
  buildWorkbenchSolvedModel,
  buildWorkbenchSolvedProject,
  resolveWorkbenchTrustGate,
  type SolvedPergola,
  type WorkbenchGeometryIdentity,
  type WorkbenchSolvedModel,
  type WorkbenchSolvedProject,
  type WorkbenchTrustGateModel,
  type WorkbenchTrustStatus,
  type WorkbenchTrustStatusKind,
  type WorkbenchViewportGeometry,
} from './workbenchSolvedModel';

type WorkbenchViewsStatus = 'loading' | 'ready' | 'error' | 'empty';

type WorkbenchDeckInteractionDiagnostic = DeckInteractionCapability;

export type DrawingWorkbenchStore = {
  persisted: {
    projectModel: WorkbenchProjectModel;
  };
  ui: DrawingWorkbenchUiState;
  derived: {
    solvedModel: WorkbenchSolvedModel;
    solvedProject: WorkbenchSolvedProject;
    activePergola: SolvedPergola | null;
    activeTrust: WorkbenchTrustStatus;
    activeTrustGate: WorkbenchTrustGateModel;
    exportReadiness: WorkbenchTrustGateModel;
    reviewReadiness: WorkbenchTrustGateModel;
    activePlanViewModel: PlanViewModel | null;
    activeDrawingSurfaceGeometry: WorkbenchDrawingSurfaceGeometry | null;
    activeViewportGeometry: WorkbenchViewportGeometry | null;
    projectSheetLabel: string;
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
    status: WorkbenchViewsStatus;
  };
};

function objectFirstDraftFromEstimateDraft(
  draft: EstimateDrawingDraft | null | undefined,
): unknown {
  if (!draft || typeof draft !== 'object') return null;
  return (draft as { objectFirst?: unknown }).objectFirst ?? null;
}

function statusFromViewportGeometry(input: {
  activeView: DrawingWorkbenchUiState['activeView'];
  viewportGeometry: WorkbenchViewportGeometry | null;
}): WorkbenchViewsStatus {
  const artifact = input.viewportGeometry?.artifact ?? null;
  if (!artifact) return 'empty';
  if (input.activeView === 'section') {
    return artifact.section ? 'ready' : 'empty';
  }
  return artifact.plan && artifact.topProjection ? 'ready' : 'empty';
}

function activeTrustIssuesForObjectState(input: {
  unresolvedOpeningHostCount: number;
  unresolvedPergolaAttachmentCount: number;
  selectedHouseStatus: ReturnType<typeof buildObjectWorkbenchStatusFacade>['selectedHouseFormStatus'];
  status: ReturnType<typeof buildObjectWorkbenchStatusFacade>;
}): WorkbenchTrustStatusKind[] {
  const issues: WorkbenchTrustStatusKind[] = [];
  if (input.unresolvedOpeningHostCount > 0 || input.unresolvedPergolaAttachmentCount > 0) {
    issues.push('unresolved_host');
  }
  if (
    input.selectedHouseStatus?.roof?.validationStatus === 'approximate' ||
    input.selectedHouseStatus?.lowConfidence ||
    (input.selectedHouseStatus?.warnings.length ?? 0) > 0
  ) {
    issues.push('approximate');
  }
  if (
    Object.values(input.status.deckStatuses).some((deck) => deck.validation.status === 'invalid') ||
    Object.values(input.status.openingStatuses).some(
      (opening) =>
        opening.validation.status === 'invalid' &&
        opening.validation.codes.some((code) => code !== 'missing_host_wall'),
    ) ||
    input.selectedHouseStatus?.roof?.validationStatus === 'invalid'
  ) {
    issues.push('invalid_geometry');
  }
  return issues;
}

export function buildDrawingWorkbenchStore(input: {
  draft?: EstimateDrawingDraft | null;
  ui: DrawingWorkbenchUiState;
  geometryIdentity?: WorkbenchGeometryIdentity | null;
  projectModel?: WorkbenchProjectModel | null;
}): DrawingWorkbenchStore {
  const projectModel =
    input.projectModel ??
    buildWorkbenchProjectModelFromObjectFirstDraft(
      objectFirstDraftFromEstimateDraft(input.draft) as Partial<ObjectFirstWorkbenchDraftVNext> | null,
    ) ??
    EMPTY_WORKBENCH_PROJECT_MODEL;
  const houseForms = projectModel.houseAssembly?.houseForms ?? [];
  const objectFirstDecks = projectModel.decks;
  const objectFirstOpenings = projectModel.openings;
  const objectFirstPergolas = projectModel.pergolas;
  const ui = normalizeDrawingWorkbenchUiState(input.ui, {
    houseFormIds: houseForms.map((houseForm) => houseForm.id),
    pergolaIds: objectFirstPergolas.map((pergola) => pergola.id),
    deckIds: objectFirstDecks.map((deck) => deck.id),
    openingIds: objectFirstOpenings.map((opening) => opening.id),
  });

  const solvedModel = buildWorkbenchSolvedModel({
    geometryIdentity: input.geometryIdentity,
    projectModel,
  });
  const solvedProject = buildWorkbenchSolvedProject({
    solvedModel,
    activePergolaId: ui.activePergolaId,
  });

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
  const activeObjectFirstPergola =
    ui.activeObjectFamily === 'pergolas'
      ? objectFirstPergolas.find((pergola) => pergola.id === ui.activeObjectRef.objectId) ?? null
      : ui.activePergolaId
        ? objectFirstPergolas.find((pergola) => pergola.id === ui.activePergolaId) ?? null
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
    activeHouseFormId: activeHouseForm?.id ?? null,
    projectModel,
  });
  const unresolvedPergolaAttachmentCount = Object.entries(pergolaAttachmentResolutions).filter(
    ([pergolaId, resolution]) =>
      resolution.status === 'unresolved' &&
      objectWorkbenchStatus.pergolaStatuses[pergolaId]?.connectionKind !== 'freestanding',
  ).length;

  const activeTrust = appendWorkbenchTrustIssues(
    solvedModel.trust,
    activeTrustIssuesForObjectState({
      unresolvedOpeningHostCount,
      unresolvedPergolaAttachmentCount,
      selectedHouseStatus: objectWorkbenchStatus.selectedHouseFormStatus,
      status: objectWorkbenchStatus,
    }),
  );
  const activeTrustGate = resolveWorkbenchTrustGate(activeTrust);
  const objectWorkbench = buildObjectWorkbenchInspectorFacade({
    activeObjectRef: ui.activeObjectRef,
    activeTrust,
    houseAssembly: projectModel.houseAssembly,
    openingHostResolutions: new Map(Object.entries(openingHostResolutions)),
    pergolaAttachmentResolutions: new Map(Object.entries(pergolaAttachmentResolutions)),
    projectModel,
    projectHouseProjectionHealth: solvedModel.projectHouseProjectionHealth,
    projectPergolaRenderHealth: solvedModel.projectPergolaRenderHealth,
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
    modules: [],
    activeTrust,
    status: objectWorkbenchStatus,
  });
  const activeDrawingSurfaceGeometry = buildWorkbenchDrawingSurfaceGeometry({
    viewportGeometry: solvedModel.projectViewportGeometry,
    planViewModel: null,
  });

  return {
    persisted: {
      projectModel,
    },
    ui,
    derived: {
      solvedModel,
      solvedProject,
      activePergola: solvedProject.activePergola,
      activeTrust,
      activeTrustGate,
      exportReadiness: activeTrustGate,
      reviewReadiness: activeTrustGate,
      activePlanViewModel: null,
      activeDrawingSurfaceGeometry,
      activeViewportGeometry: solvedModel.projectViewportGeometry,
      projectSheetLabel: 'Workbench project',
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
      status: statusFromViewportGeometry({
        activeView: ui.activeView,
        viewportGeometry: solvedModel.projectViewportGeometry,
      }),
    },
  };
}
