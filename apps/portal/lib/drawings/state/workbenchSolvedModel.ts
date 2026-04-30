import {
  buildViewerSceneModel,
  type Assembly3D,
  type GeometryConfig,
  type GeometryPlanViewModel,
  type GeometrySectionViewModel,
  type GeometryValidationReport,
  type ViewerSceneModel,
  validateGeometrySolve,
} from '@sp/geometry';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  deriveObjectWorkbenchGeometry,
  type ObjectWorkbenchPergolaRenderSource,
  type ObjectWorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import { buildObjectWorkbenchGeometryContext, type ObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import {
  resolveWorkbenchGeometryModule,
  type WorkbenchGeometryResultSource,
} from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';

type AttachmentSide = 'rear' | 'front' | 'left' | 'right';
type LocalPolygonPoint = { alongM: number; depthM: number };

export type GeometryPreviewMode = 'snapshot_validated' | 'snapshot_local_resolved' | 'draft_local_resolved';

export type GeometryPreviewState =
  | {
      kind: 'ready';
      previewMode: GeometryPreviewMode;
      resultSource: 'snapshot' | 'local_resolve';
      config: GeometryConfig;
      assembly: Assembly3D;
      validation: GeometryValidationReport;
      scene: ViewerSceneModel;
      deckSupport: WorkbenchDeckSupportDiagnostic;
    }
  | {
      kind: 'unsupported';
      previewMode: GeometryPreviewMode;
      config?: GeometryConfig;
      validation?: GeometryValidationReport;
      message: string;
      deckSupport: WorkbenchDeckSupportDiagnostic;
    }
  | {
      kind: 'error';
      message: string;
    };

export type WorkbenchTrustStatusKind =
  | 'geometry_ready'
  | 'legacy_fallback'
  | 'legacy_unsupported_family'
  | 'invalid_geometry'
  | 'unresolved_host'
  | 'approximate';

export type WorkbenchTrustStatus = {
  status: WorkbenchTrustStatusKind;
  issues: WorkbenchTrustStatusKind[];
  renderSource: ObjectWorkbenchPergolaRenderSource | 'none';
  message: string | null;
};

export type WorkbenchGeometryIdentity = {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
};

export type WorkbenchSolvedModule = {
  index: number;
  id: string;
  label: string;
  drawingModule: EstimateDrawingModule;
  moduleInput: CalculatorModuleInputs;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  draftTouchesGeometry: boolean;
  trust: WorkbenchTrustStatus;
  renderSource: ObjectWorkbenchPergolaRenderSource;
  renderStatus: ObjectWorkbenchPergolaRenderStatus;
  config: GeometryConfig | null;
  assembly: Assembly3D | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometrySection: GeometrySectionViewModel | null;
  validation: GeometryValidationReport | null;
  viewerScene: ViewerSceneModel | null;
  geometryPreview: GeometryPreviewState;
  deckSupport: WorkbenchDeckSupportDiagnostic | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

export type WorkbenchSolvedModel = {
  projectModel: WorkbenchProjectModel;
  modules: WorkbenchSolvedModule[];
  activeModule: WorkbenchSolvedModule | null;
  trust: WorkbenchTrustStatus;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
};

const DEFAULT_GEOMETRY_IDENTITY: Required<WorkbenchGeometryIdentity> = {
  projectId: 'hidden-workbench-project',
  estimateId: 'hidden-workbench-estimate',
  designRequestId: null,
};

function resolveGeometryIdentity(
  identity: WorkbenchGeometryIdentity | null | undefined,
): Required<WorkbenchGeometryIdentity> {
  return {
    projectId: identity?.projectId ?? DEFAULT_GEOMETRY_IDENTITY.projectId,
    estimateId: identity?.estimateId ?? DEFAULT_GEOMETRY_IDENTITY.estimateId,
    designRequestId: identity?.designRequestId ?? DEFAULT_GEOMETRY_IDENTITY.designRequestId,
  };
}

function resolvePreviewMode(input: {
  resultSource: 'snapshot' | 'local_resolve';
  draftTouchesGeometry: boolean;
}): GeometryPreviewMode {
  if (input.draftTouchesGeometry) return 'draft_local_resolved';
  return input.resultSource === 'local_resolve' ? 'snapshot_local_resolved' : 'snapshot_validated';
}

function parseLocalPolygon(
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): LocalPolygonPoint[] {
  return (polygon ?? [])
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

function hostEdgeSideBySourceEdgeId(
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): Map<string, AttachmentSide> {
  const localPolygon = parseLocalPolygon(polygon);
  if (!localPolygon.length) return new Map();
  const alongValues = localPolygon.map((point) => point.alongM);
  const depthValues = localPolygon.map((point) => point.depthM);
  const minAlong = Math.min(...alongValues);
  const maxAlong = Math.max(...alongValues);
  const minDepth = Math.min(...depthValues);
  const maxDepth = Math.max(...depthValues);
  const result = new Map<string, AttachmentSide>();
  for (let index = 0; index < localPolygon.length; index += 1) {
    const current = localPolygon[index]!;
    const next = localPolygon[(index + 1) % localPolygon.length]!;
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    if (Math.abs(current.depthM - next.depthM) <= 1e-6) {
      const depth = (current.depthM + next.depthM) / 2;
      result.set(
        sourceEdgeId,
        Math.abs(depth - minDepth) <= Math.abs(depth - maxDepth) ? 'rear' : 'front',
      );
      continue;
    }
    if (Math.abs(current.alongM - next.alongM) <= 1e-6) {
      const along = (current.alongM + next.alongM) / 2;
      result.set(
        sourceEdgeId,
        Math.abs(along - minAlong) <= Math.abs(along - maxAlong) ? 'left' : 'right',
      );
    }
  }
  return result;
}

function annotateSceneHostEdgeSides(
  scene: ViewerSceneModel,
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): ViewerSceneModel {
  const sideBySourceEdgeId = hostEdgeSideBySourceEdgeId(polygon);
  if (!sideBySourceEdgeId.size) return scene;
  return {
    ...scene,
    layers: scene.layers.map((layer) => ({
      ...layer,
      objects: layer.objects.map((object) => {
        const sourceEdgeId = typeof object.metadata?.sourceEdgeId === 'string' ? object.metadata.sourceEdgeId : null;
        const hostEdgeSide = sourceEdgeId ? sideBySourceEdgeId.get(sourceEdgeId) : undefined;
        if (!hostEdgeSide) return object;
        return {
          ...object,
          metadata: {
            ...(object.metadata ?? {}),
            hostEdgeSide,
          },
        };
      }),
    })),
  };
}

function annotateSceneAttachmentZoneMetadata(
  scene: ViewerSceneModel,
  geometryContext: ObjectWorkbenchGeometryContext,
): ViewerSceneModel {
  const zones = geometryContext.house?.attachmentZones ?? [];
  const blocked = geometryContext.house?.attachmentZoneDiagnostics.blocked ?? [];
  const resolvedPergolaAttachmentZoneCount = geometryContext.pergolas.filter(
    (pergola) =>
      pergola.attachment.kind !== 'freestanding' &&
      pergola.attachment.resolution.status === 'resolved' &&
      pergola.attachment.attachmentZoneId !== null,
  ).length;
  const unresolvedPergolaAttachmentZoneCount = geometryContext.pergolas.filter(
    (pergola) =>
      pergola.attachment.kind !== 'freestanding' &&
      pergola.attachment.resolution.status !== 'resolved',
  ).length;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseAttachmentZoneCount: zones.length,
      houseAttachmentZoneKinds: zones.length
        ? zones.map((zone) => `${zone.side}:${zone.kind}`).join(',')
        : 'none',
      houseAttachmentZoneBlockedReasons: blocked.length
        ? blocked.map((entry) => `${entry.side}:${entry.kind}:${entry.reason}`).join(',')
        : 'none',
      pergolaResolvedAttachmentZoneCount: resolvedPergolaAttachmentZoneCount,
      pergolaUnresolvedAttachmentZoneCount: unresolvedPergolaAttachmentZoneCount,
    },
  };
}

function numericStringValue(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function annotateSceneHouseRoofMetadata(
  scene: ViewerSceneModel,
  geometryContext: ObjectWorkbenchGeometryContext,
): ViewerSceneModel {
  const roof = geometryContext.house?.roof ?? null;
  if (!roof) return scene;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseRoofForm: roof.form,
      houseRoofGeometryKind: roof.geometryKind,
      houseRoofHealedPitchDeg: numericStringValue(roof.primaryPitchDeg),
      houseRoofHealedRidgeAxis: roof.capabilities.controls.ridgeAxis ? roof.ridgeAxis : null,
    },
  };
}

function buildViewerSceneFromSolvedGeometry(input: {
  assembly: Assembly3D;
  geometryContext: ObjectWorkbenchGeometryContext;
}): ViewerSceneModel {
  return annotateSceneHouseRoofMetadata(
    annotateSceneAttachmentZoneMetadata(
      annotateSceneHostEdgeSides(
        buildViewerSceneModel(input.assembly),
        input.geometryContext.house?.footprint.polygon,
      ),
      input.geometryContext,
    ),
    input.geometryContext,
  );
}

function uniqueIssues(issues: WorkbenchTrustStatusKind[]): WorkbenchTrustStatusKind[] {
  return Array.from(new Set(issues));
}

function buildTrustStatus(input: {
  status: WorkbenchTrustStatusKind;
  issues?: WorkbenchTrustStatusKind[];
  renderSource: ObjectWorkbenchPergolaRenderSource | 'none';
  message?: string | null;
}): WorkbenchTrustStatus {
  return {
    status: input.status,
    issues: uniqueIssues(input.issues ?? []),
    renderSource: input.renderSource,
    message: input.message ?? null,
  };
}

function collectGeometryTrustIssues(
  geometryContext: ObjectWorkbenchGeometryContext,
): WorkbenchTrustStatusKind[] {
  const issues: WorkbenchTrustStatusKind[] = [];
  if (
    geometryContext.house?.roof.validation.status === 'approximate' ||
    geometryContext.house?.lowConfidence ||
    geometryContext.warnings.length > 0
  ) {
    issues.push('approximate');
  }
  if (
    geometryContext.pergolas.some(
      (pergola) =>
        pergola.attachment.kind !== 'freestanding' &&
        pergola.attachment.resolution.status !== 'resolved',
    )
  ) {
    issues.push('unresolved_host');
  }
  return uniqueIssues(issues);
}

function buildDeckSupport(input: {
  moduleInput: CalculatorModuleInputs;
  geometryContext: ObjectWorkbenchGeometryContext;
}): WorkbenchDeckSupportDiagnostic {
  return buildWorkbenchDeckSupportDiagnostic({
    activeHostSide: resolveWorkbenchDeckSupportActiveSide(input.moduleInput),
    decks: input.geometryContext.house?.decks ?? [],
  });
}

function buildInvalidSolvedModule(input: {
  index: number;
  drawingModule: EstimateDrawingModule;
  label: string;
  moduleInput: CalculatorModuleInputs;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  draftTouchesGeometry: boolean;
  message: string;
  geometryPreviewMessage?: string;
  drawingResult: EstimateDrawingModule['result'];
  deckSupport?: WorkbenchDeckSupportDiagnostic | null;
  previewKind?: 'error' | 'unsupported';
}): WorkbenchSolvedModule {
  const drawingModule = {
    ...input.drawingModule,
    result: input.drawingResult,
  };
  const previewKind = input.previewKind ?? 'error';
  return {
    index: input.index,
    id: input.drawingModule.id,
    label: input.label,
    drawingModule,
    moduleInput: input.moduleInput,
    previewMode: input.previewMode,
    resultSource: input.resultSource,
    draftTouchesGeometry: input.draftTouchesGeometry,
    trust: buildTrustStatus({
      status: 'invalid_geometry',
      renderSource: 'legacy',
      message: input.message,
    }),
    renderSource: 'legacy',
    renderStatus: 'invalid_geometry',
    config: null,
    assembly: null,
    geometryPlan: null,
    geometrySection: null,
    validation: null,
    viewerScene: null,
    geometryPreview:
      previewKind === 'unsupported' && input.deckSupport
        ? {
            kind: 'unsupported',
            previewMode: input.previewMode,
            message: input.geometryPreviewMessage ?? input.message,
            deckSupport: input.deckSupport,
          }
        : {
            kind: 'error',
            message: input.geometryPreviewMessage ?? input.message,
          },
    deckSupport: input.deckSupport ?? null,
    planModel: null,
    sectionModel: null,
  };
}

function buildSolvedModule(input: {
  index: number;
  drawingModule: EstimateDrawingModule;
  label: string;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
  geometryContext: ObjectWorkbenchGeometryContext;
}): WorkbenchSolvedModule {
  const initialModuleInput = coerceHiddenWorkbenchGableBaseline(input.drawingModule.input);
  const resolved = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.index,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const previewMode = resolvePreviewMode({
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
  });

  if (!resolved.ok) {
    return buildInvalidSolvedModule({
      index: input.index,
      drawingModule: input.drawingModule,
      label: input.label,
      moduleInput: resolved.module ? coerceHiddenWorkbenchGableBaseline(resolved.module) : initialModuleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      message: resolved.message,
      geometryPreviewMessage: resolved.message.replace('workbench geometry', '3D geometry preview'),
      drawingResult: null,
    });
  }

  const moduleInput = coerceHiddenWorkbenchGableBaseline(resolved.module);
  const deckSupport = buildDeckSupport({
    moduleInput,
    geometryContext: input.geometryContext,
  });
  const drawingModule: EstimateDrawingModule = {
    ...input.drawingModule,
    result: resolved.moduleResult,
  };

  if (input.geometryContext.house?.roof.validation.status === 'invalid') {
    const message =
      input.geometryContext.house.roof.validation.message ??
      'The selected house roof configuration is not supported by Sanctuary geometry V1.';
    return buildInvalidSolvedModule({
      index: input.index,
      drawingModule: input.drawingModule,
      label: input.label,
      moduleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      message,
      drawingResult: resolved.moduleResult,
      deckSupport,
      previewKind: 'unsupported',
    });
  }

  const derivation = deriveObjectWorkbenchGeometry({
    projectId: input.geometryIdentity.projectId,
    estimateId: input.geometryIdentity.estimateId,
    designRequestId: input.geometryIdentity.designRequestId,
    moduleId: input.drawingModule.id,
    module: moduleInput,
    result: resolved.moduleResult,
    objectWorkbenchGeometryContext: input.geometryContext,
    fallbackPlanModel: drawingModule.planModel,
    fallbackSectionModel: drawingModule.sectionModel,
  });

  if (derivation.kind === 'legacy_unsupported_family') {
    const legacyIssues: WorkbenchTrustStatusKind[] =
      derivation.planModel || derivation.sectionModel ? ['legacy_fallback'] : [];
    return {
      index: input.index,
      id: input.drawingModule.id,
      label: input.label,
      drawingModule,
      moduleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      trust: buildTrustStatus({
        status: 'legacy_unsupported_family',
        issues: legacyIssues,
        renderSource: 'legacy',
        message: derivation.message,
      }),
      renderSource: derivation.renderSource,
      renderStatus: derivation.renderStatus,
      config: null,
      assembly: null,
      geometryPlan: null,
      geometrySection: null,
      validation: null,
      viewerScene: null,
      geometryPreview: {
        kind: 'unsupported',
        previewMode,
        message: derivation.message,
        deckSupport,
      },
      deckSupport,
      planModel: derivation.planModel,
      sectionModel: derivation.sectionModel,
    };
  }

  if (derivation.kind === 'invalid_geometry') {
    return buildInvalidSolvedModule({
      index: input.index,
      drawingModule: input.drawingModule,
      label: input.label,
      moduleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      message: derivation.message,
      drawingResult: resolved.moduleResult,
      deckSupport,
    });
  }

  const validation = validateGeometrySolve({
    config: derivation.config,
    solveResult: {
      ok: true,
      value: derivation.assembly,
    },
  });
  const scene = buildViewerSceneFromSolvedGeometry({
    assembly: derivation.assembly,
    geometryContext: input.geometryContext,
  });

  return {
    index: input.index,
    id: input.drawingModule.id,
    label: input.label,
    drawingModule,
    moduleInput,
    previewMode,
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
    trust: buildTrustStatus({
      status: 'geometry_ready',
      issues: collectGeometryTrustIssues(input.geometryContext),
      renderSource: 'geometry',
    }),
    renderSource: derivation.renderSource,
    renderStatus: derivation.renderStatus,
    config: derivation.config,
    assembly: derivation.assembly,
    geometryPlan: derivation.geometryPlan,
    geometrySection: derivation.geometrySection,
    validation,
    viewerScene: scene,
    geometryPreview: {
      kind: 'ready',
      previewMode,
      resultSource: resolved.resultSource,
      config: derivation.config,
      assembly: derivation.assembly,
      validation,
      scene,
      deckSupport,
    },
    deckSupport,
    planModel: derivation.planModel,
    sectionModel: derivation.sectionModel,
  };
}

export function buildWorkbenchSolvedModel(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
  activeModuleIndex?: number;
  geometryIdentity?: WorkbenchGeometryIdentity | null;
  projectModel?: WorkbenchProjectModel | null;
  drawingModules?: EstimateDrawingModule[];
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
}): WorkbenchSolvedModel {
  const geometryIdentity = resolveGeometryIdentity(input.geometryIdentity);
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const drawingModules =
    input.drawingModules ??
    buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: input.ignoreModuleResults,
    });
  const geometryContext =
    input.objectWorkbenchGeometryContext ??
    buildObjectWorkbenchGeometryContext({
      snapshot: input.snapshot,
      draft: input.draft,
      projectModel: input.projectModel,
      ignoreModuleResults: input.ignoreModuleResults,
    });
  const projectModel = input.projectModel ?? geometryContext.projectModel;
  const modules = drawingModules.map((drawingModule, index) =>
    buildSolvedModule({
      index,
      drawingModule,
      label: input.moduleLabels?.[index] ?? drawingModule.label,
      snapshot: input.snapshot,
      draft: input.draft,
      ignoreModuleResults: input.ignoreModuleResults,
      geometryIdentity,
      geometryContext,
    }),
  );
  const activeModule = modules[input.activeModuleIndex ?? 0] ?? null;

  return {
    projectModel,
    modules,
    activeModule,
    trust:
      activeModule?.trust ??
      buildTrustStatus({
        status: 'invalid_geometry',
        renderSource: 'none',
        message: 'No active workbench module is available.',
      }),
    geometryIdentity,
  };
}

export function buildGeometryPreviewStateFromSolvedModule(
  module: WorkbenchSolvedModule | null,
  fallbackMessage = 'The selected module is not available for 3D geometry preview.',
): GeometryPreviewState {
  return module?.geometryPreview ?? { kind: 'error', message: fallbackMessage };
}
