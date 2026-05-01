import {
  buildViewerSceneModel,
  type Assembly3D,
  type GeometryConfig,
  type GeometryPlanViewModel,
  type GeometrySectionViewModel,
  type GeometryTopProjectionViewModel,
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
import type { CalculatorHouseAttachmentStrategy, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import { resolveObjectFirstPergolaAttachment } from './objectFirstDerivedHosting';

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
      topProjection: GeometryTopProjectionViewModel;
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

export type WorkbenchTrustGateAction = 'pass' | 'warn' | 'block';

export type WorkbenchTrustGateModel = {
  status: WorkbenchTrustGateAction;
  trustStatus: WorkbenchTrustStatusKind;
  issues: WorkbenchTrustStatusKind[];
  blockingIssues: WorkbenchTrustStatusKind[];
  warningIssues: WorkbenchTrustStatusKind[];
  canExport: boolean;
  canReview: boolean;
  label: string;
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
  geometryTopProjection: GeometryTopProjectionViewModel | null;
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

const EMPTY_WORKBENCH_PROJECT_MODEL: WorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot',
  houseAssembly: null,
  decks: [],
  openings: [],
  pergolas: [],
  warnings: [],
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

type AttachmentZoneKind = 'wall' | 'soffit' | 'fascia' | 'roof_edge';
type AttachmentBlockReason = 'side_openings_block_wall' | 'side_openings_block_roof_zone';

function resolveAttachmentStrategyZoneKinds(
  strategy: CalculatorHouseAttachmentStrategy | null,
): AttachmentZoneKind[] {
  if (strategy === 'none') return [];
  const kinds = new Set<AttachmentZoneKind>();
  if (strategy === 'facade_ledger' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('wall');
  }
  if (strategy === 'soffit_brackets' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('soffit');
  }
  if (strategy === 'fascia_under_gutter' || strategy === null) {
    kinds.add('fascia');
  }
  if (strategy === 'fascia_under_gutter') {
    kinds.add('roof_edge');
  }
  return Array.from(kinds);
}

function isAttachmentSide(value: unknown): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function openingBlocksAttachmentZone(opening: WorkbenchProjectModel['openings'][number]): boolean {
  return opening.validation?.status !== 'invalid';
}

function openingBlocksRoofAttachmentZone(opening: WorkbenchProjectModel['openings'][number]): boolean {
  return openingBlocksAttachmentZone(opening) && (opening.kind === 'slider' || opening.kind === 'stacker');
}

function resolveOpeningAttachmentSide(input: {
  projectModel: WorkbenchProjectModel;
  opening: WorkbenchProjectModel['openings'][number];
}): AttachmentSide | null {
  if (isAttachmentSide(input.opening.wallId)) return input.opening.wallId;
  const envelope = input.projectModel.houseAssembly?.derivedEnvelope ?? null;
  const zones = envelope?.attachmentZones ?? [];
  const zone = zones.find((candidate) =>
    (input.opening.hostEdgeId && candidate.hostEdgeId === input.opening.hostEdgeId) ||
    (input.opening.hostWallId && candidate.hostWallId === input.opening.hostWallId),
  );
  return zone?.side ?? null;
}

function resolveAttachmentZoneBlockedReasons(
  projectModel: WorkbenchProjectModel | null | undefined,
): string {
  if (!projectModel?.houseAssembly) return 'none';
  const houseForm = projectModel.houseAssembly.houseForms[0] ?? null;
  const candidateKinds = resolveAttachmentStrategyZoneKinds(houseForm?.attachmentStrategy ?? null);
  if (!candidateKinds.length) return 'none';

  const blocked = new Set<string>();
  for (const opening of projectModel.openings) {
    const side = resolveOpeningAttachmentSide({ projectModel, opening });
    if (!side) continue;
    for (const kind of candidateKinds) {
      const reason: AttachmentBlockReason | null =
        kind === 'wall' && openingBlocksAttachmentZone(opening)
          ? 'side_openings_block_wall'
          : kind !== 'wall' && openingBlocksRoofAttachmentZone(opening)
            ? 'side_openings_block_roof_zone'
            : null;
      if (reason) {
        blocked.add(`${side}:${kind}:${reason}`);
      }
    }
  }

  return blocked.size ? Array.from(blocked).join(',') : 'none';
}

function annotateSceneAttachmentZoneMetadata(
  scene: ViewerSceneModel,
  geometryContext: ObjectWorkbenchGeometryContext,
): ViewerSceneModel {
  const projectModel = geometryContext.projectModel;
  const houseAssembly = projectModel?.houseAssembly ?? null;
  const zones = houseAssembly?.derivedEnvelope?.attachmentZones ?? [];
  const pergolaAttachmentResolutions = (projectModel?.pergolas ?? []).map((pergola) =>
    resolveObjectFirstPergolaAttachment({ houseAssembly, pergola }),
  );
  const resolvedPergolaAttachmentZoneCount = pergolaAttachmentResolutions.filter(
    (resolution) => resolution.status === 'resolved' && resolution.attachmentZoneId !== null,
  ).length;
  const unresolvedPergolaAttachmentZoneCount = pergolaAttachmentResolutions.filter(
    (resolution) => resolution.status !== 'resolved',
  ).length;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseAttachmentZoneCount: zones.length,
      houseAttachmentZoneKinds: zones.length
        ? zones.map((zone) => `${zone.side}:${zone.kind}`).join(',')
        : 'none',
      houseAttachmentZoneBlockedReasons: resolveAttachmentZoneBlockedReasons(projectModel),
      pergolaResolvedAttachmentZoneCount: resolvedPergolaAttachmentZoneCount,
      pergolaUnresolvedAttachmentZoneCount: unresolvedPergolaAttachmentZoneCount,
    },
  };
}

function annotateSceneHouseRoofMetadata(
  scene: ViewerSceneModel,
  config: GeometryConfig,
): ViewerSceneModel {
  const roof = config.houseContext.model ?? null;
  if (!roof) return scene;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseRoofForm: roof.roofForm ?? null,
      houseRoofHealedPitchDeg: roof.roofPitchDeg ?? null,
      houseRoofHealedRidgeAxis: roof.roofRidgeAxis ?? null,
    },
  };
}

function buildViewerSceneFromSolvedGeometry(input: {
  config: GeometryConfig;
  assembly: Assembly3D;
  geometryContext: ObjectWorkbenchGeometryContext;
}): ViewerSceneModel {
  return annotateSceneHouseRoofMetadata(
    annotateSceneAttachmentZoneMetadata(
      annotateSceneHostEdgeSides(
        buildViewerSceneModel(input.assembly),
        input.geometryContext.projectModel?.houseAssembly?.houseForms[0]?.footprint.polygon,
      ),
      input.geometryContext,
    ),
    input.config,
  );
}

function uniqueIssues(issues: WorkbenchTrustStatusKind[]): WorkbenchTrustStatusKind[] {
  return Array.from(new Set(issues));
}

function isBlockingTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return issue === 'invalid_geometry' || issue === 'unresolved_host';
}

function isWarningTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return (
    issue === 'approximate' ||
    issue === 'legacy_fallback' ||
    issue === 'legacy_unsupported_family'
  );
}

function sortTrustIssuesByPriority(
  issues: WorkbenchTrustStatusKind[],
  priority: WorkbenchTrustStatusKind[],
): WorkbenchTrustStatusKind[] {
  return [...issues].sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    return (leftIndex === -1 ? priority.length : leftIndex) -
      (rightIndex === -1 ? priority.length : rightIndex);
  });
}

export function labelForWorkbenchTrustStatus(status: WorkbenchTrustStatusKind): string {
  switch (status) {
    case 'geometry_ready':
      return 'Geometry ready';
    case 'legacy_fallback':
      return 'Legacy fallback';
    case 'legacy_unsupported_family':
      return 'Unsupported family';
    case 'invalid_geometry':
      return 'Invalid geometry';
    case 'unresolved_host':
      return 'Unresolved host';
    case 'approximate':
      return 'Approximate';
    default:
      return 'Unknown';
  }
}

function messageForWorkbenchTrustIssue(
  issue: WorkbenchTrustStatusKind,
  trust: WorkbenchTrustStatus,
): string {
  if (trust.status === issue && trust.message) return trust.message;
  switch (issue) {
    case 'invalid_geometry':
      return 'Geometry is invalid. Resolve the blocking geometry issue before export or review.';
    case 'unresolved_host':
      return 'Resolve unresolved object hosts before export or review.';
    case 'approximate':
      return 'Geometry is approximate. Export and review can continue with a warning.';
    case 'legacy_fallback':
      return 'This view is using legacy fallback geometry. Verify accuracy before export or review.';
    case 'legacy_unsupported_family':
      return 'This family is not fully supported by native geometry. Verify accuracy before export or review.';
    case 'geometry_ready':
      return 'Geometry is ready for export and review.';
    default:
      return 'Review geometry trust before export.';
  }
}

export function appendWorkbenchTrustIssues(
  trust: WorkbenchTrustStatus,
  issues: WorkbenchTrustStatusKind[],
): WorkbenchTrustStatus {
  if (!issues.length) return trust;
  return {
    ...trust,
    issues: uniqueIssues([...trust.issues, ...issues]),
  };
}

export function resolveWorkbenchTrustGate(trust: WorkbenchTrustStatus): WorkbenchTrustGateModel {
  const issues = uniqueIssues([trust.status, ...trust.issues].filter(
    (issue) => issue !== 'geometry_ready',
  ));
  const blockingIssues = sortTrustIssuesByPriority(
    issues.filter(isBlockingTrustIssue),
    ['invalid_geometry', 'unresolved_host'],
  );
  const warningIssues = sortTrustIssuesByPriority(
    issues.filter(isWarningTrustIssue),
    ['legacy_fallback', 'legacy_unsupported_family', 'approximate'],
  );
  const firstBlockingIssue = blockingIssues[0] ?? null;
  const firstWarningIssue = warningIssues[0] ?? null;
  const status: WorkbenchTrustGateAction = firstBlockingIssue
    ? 'block'
    : firstWarningIssue
      ? 'warn'
      : 'pass';
  const primaryIssue = firstBlockingIssue ?? firstWarningIssue;

  return {
    status,
    trustStatus: primaryIssue ?? trust.status,
    issues,
    blockingIssues,
    warningIssues,
    canExport: status !== 'block',
    canReview: status !== 'block',
    label: primaryIssue
      ? `${status === 'block' ? 'Blocked' : 'Warning'}: ${labelForWorkbenchTrustStatus(primaryIssue)}`
      : labelForWorkbenchTrustStatus('geometry_ready'),
    message: primaryIssue ? messageForWorkbenchTrustIssue(primaryIssue, trust) : null,
  };
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
  const projectModel = geometryContext.projectModel;
  if ((projectModel?.warnings.length ?? 0) > 0) {
    issues.push('approximate');
  }
  return uniqueIssues(issues);
}

function buildDeckSupport(input: {
  moduleInput: CalculatorModuleInputs;
  geometryContext: ObjectWorkbenchGeometryContext;
}): WorkbenchDeckSupportDiagnostic {
  return buildWorkbenchDeckSupportDiagnostic({
    activeHostSide: resolveWorkbenchDeckSupportActiveSide(input.moduleInput),
    decks: input.geometryContext.projectModel?.decks ?? [],
  });
}

function previewMessageFromWorkbenchMessage(message: string): string {
  return message.replace('workbench geometry', '3D geometry preview');
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
    geometryTopProjection: null,
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
      geometryPreviewMessage: previewMessageFromWorkbenchMessage(resolved.message),
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
      geometryTopProjection: null,
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
    config: derivation.config,
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
    geometryTopProjection: derivation.geometryTopProjection,
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
      topProjection: derivation.geometryTopProjection,
      deckSupport,
    },
    deckSupport,
    planModel: derivation.planModel,
    sectionModel: derivation.sectionModel,
  };
}

function resolveInactiveSolvedModelMessage(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  activeModuleIndex?: number;
  drawingModules?: EstimateDrawingModule[];
}): string {
  if (input.drawingModules?.length) {
    return 'The selected module is not available for workbench geometry.';
  }
  const resolution = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.activeModuleIndex ?? 0,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  return resolution.ok ? 'No active workbench module is available.' : resolution.message;
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
  const projectModel = input.projectModel ?? geometryContext.projectModel ?? EMPTY_WORKBENCH_PROJECT_MODEL;
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
  const inactiveMessage = activeModule ? null : resolveInactiveSolvedModelMessage(input);

  return {
    projectModel,
    modules,
    activeModule,
    trust:
      activeModule?.trust ??
      buildTrustStatus({
        status: 'invalid_geometry',
        renderSource: 'none',
        message: inactiveMessage ?? 'No active workbench module is available.',
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

export function buildGeometryPreviewStateFromSolvedModel(
  model: WorkbenchSolvedModel,
  fallbackMessage = 'The selected module is not available for 3D geometry preview.',
): GeometryPreviewState {
  return buildGeometryPreviewStateFromSolvedModule(
    model.activeModule,
    model.trust.message ? previewMessageFromWorkbenchMessage(model.trust.message) : fallbackMessage,
  );
}
