import type {
  Assembly3D,
  GeometryConfig,
  GeometryPlanViewModel,
  GeometryQuantityTakeoff,
  GeometrySectionViewModel,
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
  GeometryValidationReport,
  ViewerSceneModel,
} from '@sp/geometry';
import {
  buildProjectHouseGeometryRegistry,
  type ProjectHouseGeometryEntry,
} from './projectHouseGeometryRegistry';
import {
  buildProjectObjectRenderPipeline,
  type ProjectPergolaRenderArtifact,
  type ProjectPergolaRenderHealth,
} from './projectObjectRenderPipeline';
import type { ProjectHouseProjectionHealth } from './projectHouseProjectionHealth';
import {
  EMPTY_WORKBENCH_PROJECT_MODEL,
  type PergolaObjectModel,
  type WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';
import { buildProjectPergolaViewerSceneFromPergolaArtifacts } from './projectPergolaViewerScene';
import {
  buildWorkbenchSolvedProjectArtifact,
  type WorkbenchSolvedProjectArtifact,
} from './workbenchSolvedProjectArtifact';
import { buildProjectPergolaRenderArtifacts } from './projectPergolaRenderArtifacts';

export type GeometryPreviewMode = 'project_solved' | 'draft_project_solved';

type WorkbenchDeckSupportDiagnostic = {
  activeHostSide: 'rear' | 'front' | 'left' | 'right';
  hasRelevantDeck: boolean;
  relevantDeckIds: string[];
  relevantDeckCount: number;
  positiveDeckIds: string[];
  eligibleDeckIds: string[];
  resolvedClassification: 'ground_supported' | 'threshold_attached' | 'mixed_or_unclear' | 'none';
  deckBracketEligible: boolean;
  warningCodes: string[];
  warningMessages: string[];
};

export type GeometryPreviewState =
  | {
      kind: 'ready';
      previewMode: GeometryPreviewMode;
      resultSource: 'project_solve';
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
  | 'invalid_geometry'
  | 'unresolved_host'
  | 'approximate';

export type WorkbenchTrustStatus = {
  status: WorkbenchTrustStatusKind;
  issues: WorkbenchTrustStatusKind[];
  renderSource: WorkbenchPergolaRenderSource | 'none';
  message: string | null;
};

type WorkbenchTrustGateAction = 'pass' | 'warn' | 'block';

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

export type WorkbenchPergolaRenderSource = 'geometry' | 'none';
export type WorkbenchPergolaRenderStatus =
  | 'geometry_ready'
  | 'invalid_geometry';

type WorkbenchSolvedGeometryArtifactFallback =
  | null
  | 'invalid_geometry';

export type WorkbenchSolvedGeometryArtifact = {
  source: 'solved_geometry';
  fallback: WorkbenchSolvedGeometryArtifactFallback;
  previewMode: GeometryPreviewMode;
  resultSource: 'project_solve';
  deckSupport: WorkbenchDeckSupportDiagnostic;
  config: GeometryConfig;
  assembly: Assembly3D;
  plan: GeometryPlanViewModel;
  section: GeometrySectionViewModel;
  quantityTakeoff: GeometryQuantityTakeoff;
  topProjection: GeometryTopProjectionViewModel;
  viewerScene: ViewerSceneModel;
  validation: GeometryValidationReport;
  trust: WorkbenchTrustStatus;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
};

export type WorkbenchViewportGeometry = {
  artifact: WorkbenchSolvedGeometryArtifact | null;
  preview: GeometryPreviewState;
};

export type WorkbenchSolvedModel = {
  projectModel: WorkbenchProjectModel;
  projectArtifact: WorkbenchSolvedProjectArtifact;
  trust: WorkbenchTrustStatus;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
};

export type WorkbenchSolvedProject = {
  projectModel: WorkbenchProjectModel;
  projectArtifact: WorkbenchSolvedProjectArtifact;
  pergolas: PergolaObjectModel[];
  activePergolaId: string | null;
  activePergola: PergolaObjectModel | null;
  trust: WorkbenchTrustStatus;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
};

const DEFAULT_GEOMETRY_IDENTITY: Required<WorkbenchGeometryIdentity> = {
  projectId: 'workbench-project',
  estimateId: 'workbench-estimate',
  designRequestId: null,
};

const EMPTY_DECK_SUPPORT: WorkbenchDeckSupportDiagnostic = {
  activeHostSide: 'rear',
  hasRelevantDeck: false,
  relevantDeckIds: [],
  relevantDeckCount: 0,
  positiveDeckIds: [],
  eligibleDeckIds: [],
  resolvedClassification: 'none',
  deckBracketEligible: false,
  warningCodes: [],
  warningMessages: [],
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

function uniqueIssues(issues: WorkbenchTrustStatusKind[]): WorkbenchTrustStatusKind[] {
  return Array.from(new Set(issues));
}

function isBlockingTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return issue === 'invalid_geometry' || issue === 'unresolved_host';
}

function isWarningTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return issue === 'approximate';
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
    ['approximate'],
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
  renderSource?: WorkbenchPergolaRenderSource | 'none';
  message?: string | null;
}): WorkbenchTrustStatus {
  return {
    status: input.status,
    issues: uniqueIssues(input.issues ?? []),
    renderSource: input.renderSource ?? 'none',
    message: input.message ?? null,
  };
}

function emptyValidationReport(): GeometryValidationReport {
  return {
    status: 'pass',
    invariants: [],
    unsupportedReasons: [],
    fixtureComparisons: [],
  };
}

function emptyQuantityTakeoff(): GeometryQuantityTakeoff {
  return {
    family: 'mono',
    primaryDimensionsMm: null,
    primaryDimensionsM: null,
    secondaryDimensionsMm: null,
    secondaryDimensionsM: null,
    roofPlanes: { count: 0, items: [], totalAreaMm2: 0, totalAreaM2: 0 },
    members: { items: [], byRole: {}, totalLengthM: 0 },
    rafters: {
      items: [],
      count: 0,
      totalLengthM: 0,
      averageLengthM: null,
      averageProjectedRunM: null,
      effectiveRunM: null,
    },
    beams: {
      ledgerLengthM: null,
      supportBeamLengthM: null,
      totalBeamLengthM: null,
      ridgeLengthM: null,
      tieBeamLengthM: null,
    },
    gutters: {
      ourGutterLengthM: null,
      houseGutterLengthM: null,
      totalLengthM: null,
    },
    roofCladding: {
      acrylicAreaM2: null,
      effectiveRunM: null,
      acrylicRequiredDownslopeM: null,
      averageDownslopeLengthM: null,
      panelCount: null,
      totalAreaM2: null,
      items: [],
    },
    joiners: {
      count: null,
      totalLengthM: null,
      averageLengthM: null,
      items: [],
    },
    flashings: {
      items: [],
      count: 0,
      totalLengthM: 0,
      totalSurfaceAreaM2: 0,
      byGirthMm: {},
    },
    quantityHooks: [],
    quantityHookMap: {},
    diagnostics: [],
  } as unknown as GeometryQuantityTakeoff;
}

function emptyGeometryConfig(identity: Required<WorkbenchGeometryIdentity>): GeometryConfig {
  const config = {
    projectId: identity.projectId,
    estimateId: identity.estimateId,
    designRequestId: identity.designRequestId,
    family: 'mono',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 0, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 0,
      projectionMm: 0,
      roofPitchDeg: 0,
    },
    roof: {
      material: 'acrylic',
      mode: null,
      fallDirection: 'positiveY',
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: {
      type: 'freestanding',
      attachmentSide: 'rear',
    },
    supports: {
      postMode: 'standard',
      postCount: 0,
      postCutHeightMm: null,
      footingType: null,
      postConnectionType: null,
      groundCondition: null,
      groundLevelMm: null,
    },
    structural: {
      heights: {
        houseUndersideMm: null,
        outerUndersideMm: null,
        referenceUndersideMm: null,
      },
      profiles: {
        post: null,
        rafter: null,
        ledger: null,
        supportBeam: null,
        gutter: null,
        ridge: null,
        tieBeam: null,
        strut: null,
        boxPerimeter: null,
      },
      framing: {
        rafterCount: null,
        rafterSpacingMm: null,
      },
      drainage: {
        gutterType: null,
        gutterAssemblyMode: null,
        integratedGutterBeam: null,
        hasOurGutter: null,
      },
    },
    houseReference: {
      houseId: null,
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: null,
      footprint: null,
      footprintMode: null,
      footprintPolygon: null,
      position: null,
      model: null,
      attachmentStrategy: null,
    },
  };
  return config as unknown as GeometryConfig;
}

function emptyAssembly(config: GeometryConfig): Assembly3D {
  return {
    family: config.family,
    datum: config.datum,
    outline: [],
    attachmentEdge: null,
    house: {
      footprint: [],
      roofEaves: [],
      openings: [],
      decks: [],
      model: null,
      position: null,
    } as Assembly3D['house'],
    members: [],
    roofPlanes: [],
    roofCladdingPanels: [],
    roofFlashings: [],
    supportConditions: [],
    quantityHooks: [],
    semantics: {
      connectionType: config.connection.type,
      roofType: config.family,
      structuralZones: [],
      primaryDimensionsMm: { length: 0, projection: 0 },
      secondaryDimensionsMm: null,
    },
  };
}

function emptyPlan(): GeometryPlanViewModel {
  return {
    family: 'mono',
    connectionType: 'freestanding',
    roofForm: { mono: true, gable: false, box: false },
    outline: [],
    attachmentEdge: null,
    house: {
      footprint: null,
      fasciaLine: null,
      roofEdgeLine: null,
      wallReferenceLine: null,
      surfaces: [],
      lines: [],
    },
    members: {
      posts: [],
      beams: [],
      ledgers: [],
      rafters: [],
      gutters: [],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [],
      roofCladding: [],
    },
    anchors: {
      primarySize: { length: null, projection: null },
      fall: null,
      rafterSpacing: null,
      ridgeLine: null,
      attachmentSide: null,
    },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      lengthMm: 0,
      projectionMm: 0,
    },
  };
}

function emptySection(): GeometrySectionViewModel {
  return {
    family: 'mono',
    connectionType: 'freestanding',
    sectionKind: 'mono',
    roofForm: { mono: true, gable: false, box: false },
    sliceXMm: 0,
    baseline: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    house: {
      referenceLine: null,
      surfaces: [],
      lines: [],
    },
    members: {
      posts: [],
      ledgers: [],
      supportBeams: [],
      gutters: [],
      rafters: [],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [],
      roofCladding: [],
    },
    anchors: {
      span: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
      leftEdgeHeight: null,
      rightEdgeHeight: null,
      ridgeHeight: null,
      pitch: null,
    },
    metrics: {
      spanMm: 0,
      leftEdgeHeightMm: null,
      rightEdgeHeightMm: null,
      ridgeHeightMm: null,
      pitchDeg: null,
      boxRiseMm: null,
    },
    extents: {
      minProjectionMm: 0,
      maxProjectionMm: 0,
      minHeightMm: 0,
      maxHeightMm: 0,
    },
  };
}

function buildProjectPreview(input: {
  identity: Required<WorkbenchGeometryIdentity>;
  pergolaArtifacts: ReadonlyArray<ProjectPergolaRenderArtifact>;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
  projectPergolaFallbackPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPlanProjection: GeometryTopProjectionViewModel | null;
}): GeometryPreviewState {
  const scene = buildProjectPergolaViewerSceneFromPergolaArtifacts({
    basisScene: null,
    pergolaArtifacts: input.pergolaArtifacts,
    projectHouseGeometries: input.projectHouseGeometries,
    projectPergolaRenderHealth: input.projectPergolaRenderHealth,
    projectPergolaFallbackPlanShapes: input.projectPergolaFallbackPlanShapes,
  });
  if (scene.layers.length === 0) {
    return {
      kind: 'error',
      message: 'No object-first workbench geometry is available.',
    };
  }
  const config = emptyGeometryConfig(input.identity);
  return {
    kind: 'ready',
    previewMode: 'draft_project_solved',
    resultSource: 'project_solve',
    config,
    assembly: emptyAssembly(config),
    validation: emptyValidationReport(),
    scene: {
      ...scene,
      metadata: {
        ...(scene.metadata ?? {}),
        projectPreviewSource: 'object_first_project',
      },
    },
    topProjection: input.projectPlanProjection ?? {
      coordinateSpace: 'world_xy_mm',
      screenAxis: { x: 'world_x_right', y: 'world_y_down' },
      shapes: [],
      extents: null,
    },
    deckSupport: EMPTY_DECK_SUPPORT,
  };
}

function buildProjectViewportGeometry(preview: GeometryPreviewState): WorkbenchViewportGeometry | null {
  if (preview.kind !== 'ready') return null;
  const trust = buildTrustStatus({ status: 'geometry_ready' });
  const artifact: WorkbenchSolvedGeometryArtifact = {
    source: 'solved_geometry',
    fallback: null,
    previewMode: preview.previewMode,
    resultSource: preview.resultSource,
    deckSupport: preview.deckSupport,
    config: preview.config,
    assembly: preview.assembly,
    plan: emptyPlan(),
    section: emptySection(),
    quantityTakeoff: emptyQuantityTakeoff(),
    topProjection: preview.topProjection,
    viewerScene: preview.scene,
    validation: preview.validation,
    trust,
    renderSource: 'geometry',
    renderStatus: 'geometry_ready',
  };
  return {
    artifact,
    preview,
  };
}

function hasBlockingHouseGeometry(health: ReadonlyArray<ProjectHouseProjectionHealth>): boolean {
  return health.some((entry) => entry.failureStage !== 'none' || entry.roofValidationStatus === 'invalid');
}

function pergolaTrustIssues(
  health: ReadonlyArray<ProjectPergolaRenderHealth>,
): WorkbenchTrustStatusKind[] {
  const issues: WorkbenchTrustStatusKind[] = [];
  for (const entry of health) {
    if (entry.hostAttachmentStatus === 'unresolved') {
      issues.push('unresolved_host');
    }
    if (entry.solveStatus !== 'geometry_ready') {
      issues.push('invalid_geometry');
    }
  }
  return uniqueIssues(issues);
}

function buildProjectTrust(input: {
  houseHealth: ReadonlyArray<ProjectHouseProjectionHealth>;
  pergolaHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
}): WorkbenchTrustStatus {
  const houseInvalid = hasBlockingHouseGeometry(input.houseHealth);
  const pergolaIssues = pergolaTrustIssues(input.pergolaHealth);
  const issues = uniqueIssues([
    ...(houseInvalid ? ['invalid_geometry' as const] : []),
    ...pergolaIssues,
  ]);
  const status: WorkbenchTrustStatusKind =
    issues.includes('invalid_geometry')
      ? 'invalid_geometry'
      : issues.includes('unresolved_host')
        ? 'unresolved_host'
        : 'geometry_ready';
  return buildTrustStatus({
    status,
    issues,
    message:
      status === 'invalid_geometry'
        ? 'One or more project objects failed package geometry.'
        : status === 'unresolved_host'
          ? 'Resolve unresolved pergola hosts before export or review.'
          : null,
  });
}

export function buildWorkbenchSolvedModel(input: {
  projectModel?: WorkbenchProjectModel | null;
  geometryIdentity?: WorkbenchGeometryIdentity | null;
}): WorkbenchSolvedModel {
  const geometryIdentity = resolveGeometryIdentity(input.geometryIdentity);
  const projectModel = input.projectModel ?? EMPTY_WORKBENCH_PROJECT_MODEL;
  const projectHouseGeometries = buildProjectHouseGeometryRegistry(projectModel);
  const pergolaArtifacts = buildProjectPergolaRenderArtifacts({
    projectModel,
    geometryIdentity,
    projectHouseGeometries,
  });
  const projectRenderPipeline = buildProjectObjectRenderPipeline({
    projectModel,
    pergolaArtifacts,
    projectHouseGeometries,
  });
  const projectGeometryPreview = buildProjectPreview({
    identity: geometryIdentity,
    pergolaArtifacts,
    projectHouseGeometries: projectRenderPipeline.projectHouseGeometries,
    projectPergolaRenderHealth: projectRenderPipeline.projectPergolaRenderHealth,
    projectPergolaFallbackPlanShapes: projectRenderPipeline.projectPergolaFallbackPlanShapes,
    projectPlanProjection: projectRenderPipeline.projectPlanProjection,
  });
  const projectViewportGeometry = buildProjectViewportGeometry(projectGeometryPreview);
  const trust = buildProjectTrust({
    houseHealth: projectRenderPipeline.projectHouseProjectionHealth,
    pergolaHealth: projectRenderPipeline.projectPergolaRenderHealth,
  });
  const projectArtifact = buildWorkbenchSolvedProjectArtifact({
    projectModel,
    projectHouseGeometries: projectRenderPipeline.projectHouseGeometries,
    projectPergolaPlanShapes: projectRenderPipeline.projectPergolaPlanShapes,
    projectPergolaFallbackPlanShapes: projectRenderPipeline.projectPergolaFallbackPlanShapes,
    projectPergolaRenderHealth: projectRenderPipeline.projectPergolaRenderHealth,
    projectHouseProjectionHealth: projectRenderPipeline.projectHouseProjectionHealth,
    houseGeometryInputsById: projectRenderPipeline.houseGeometryInputsById,
    projectPlanProjection: projectRenderPipeline.projectPlanProjection,
    projectViewportGeometry,
    projectGeometryPreview,
    projectReferenceShapes: projectRenderPipeline.projectReferenceShapes,
    trust,
  });

  return {
    projectModel,
    projectArtifact,
    trust,
    geometryIdentity,
  };
}

export function buildWorkbenchSolvedProject(input: {
  solvedModel: WorkbenchSolvedModel;
  activePergolaId?: string | null;
}): WorkbenchSolvedProject {
  const activePergolaId = input.activePergolaId ?? null;
  return {
    projectModel: input.solvedModel.projectModel,
    projectArtifact: input.solvedModel.projectArtifact,
    pergolas: input.solvedModel.projectModel.pergolas,
    activePergolaId,
    activePergola: activePergolaId
      ? input.solvedModel.projectModel.pergolas.find((pergola) => pergola.id === activePergolaId) ?? null
      : null,
    trust: input.solvedModel.trust,
    geometryIdentity: input.solvedModel.geometryIdentity,
  };
}

export function buildGeometryPreviewStateFromSolvedModel(
  model: WorkbenchSolvedModel,
): GeometryPreviewState {
  return model.projectArtifact.geometryPreview;
}
