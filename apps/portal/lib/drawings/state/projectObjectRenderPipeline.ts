import {
  buildProjectReferenceShapes,
  type Assembly3D,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
  type ProjectPergolaEntry,
  type ViewerSceneModel,
} from '@sp/geometry';
import { resolveObjectFirstPergolaAttachment } from './objectFirstDerivedHosting';
import type { PergolaObjectModel, WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import {
  type ProjectHouseGeometryEntry,
} from './projectHouseGeometryRegistry';
import {
  buildProjectHouseRenderPipeline,
  type ProjectHouseRenderPipeline,
} from './projectHouseRenderPipeline';
import type { HouseFormGeometryInputDiagnostics } from './houseFormGeometryInput';
import {
  type ProjectHouseProjectionHealth,
} from './projectHouseProjectionHealth';
import { buildProjectPergolaPlanShapesFromPergolaArtifacts } from './projectPergolaPlanShapes';
import { buildProjectPlanProjection } from './projectPlanProjection';
import type {
  WorkbenchPergolaRenderStatus,
  WorkbenchTrustStatus,
} from './workbenchSolvedModel';

type ProjectPergolaRenderSuppressionReason =
  | 'none'
  | 'missing_pergola_id'
  | 'missing_project_object'
  | 'unresolved_host'
  | 'invalid_geometry';

type ProjectPergolaHostAttachmentStatus =
  | 'resolved'
  | 'unresolved'
  | 'freestanding'
  | 'unknown';

type ProjectPergolaSourceKind = 'object_first_pergola';

type ProjectPergolaSolveStatus =
  | 'geometry_ready'
  | 'using_reference_geometry'
  | 'empty'
  | 'unsupported'
  | 'invalid_geometry';

export type ProjectPergolaRenderHealth = {
  pergolaId: string;
  artifactId: string;
  sourceKind: ProjectPergolaSourceKind;
  solveStatus: ProjectPergolaSolveStatus;
  hostObjectId: string | null;
  hostEdgeId: string | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
  hostAttachmentCode: string | null;
  placementStatus: ProjectPergolaHostAttachmentStatus;
  placementCode: string | null;
  planBodyCount: number;
  sceneBodyCount: number;
  canRenderCommittedBody: boolean;
  suppressedCommittedBodyReason: ProjectPergolaRenderSuppressionReason;
};

export type ProjectPergolaRenderArtifact = {
  artifactId: string;
  pergolaId: string | null;
  renderStatus: WorkbenchPergolaRenderStatus;
  trust: WorkbenchTrustStatus;
  assembly: Assembly3D | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  viewerScene: ViewerSceneModel | null;
};

type ProjectObjectRenderPipeline = {
  projectHouseGeometries: ProjectHouseGeometryEntry[];
  projectHousePlanShapes: GeometryTopProjectionShape[];
  projectPergolaPlanShapes: GeometryTopProjectionShape[];
  projectPergolaFallbackPlanShapes: GeometryTopProjectionShape[];
  projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
  projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
  houseGeometryInputsById: Record<string, HouseFormGeometryInputDiagnostics>;
  projectPlanProjection: GeometryTopProjectionViewModel | null;
  projectReferenceShapes: GeometryTopProjectionShape[];
};

type ProjectPergolaSceneSource = {
  pergolaId?: string | null;
  viewerScene: ViewerSceneModel | null;
};

function projectPergolaIdFromShape(shape: GeometryTopProjectionShape): string | null {
  const taggedPergolaId =
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null;
  return taggedPergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? null;
}

function countPergolaSceneBodies(artifact: ProjectPergolaSceneSource): number {
  return (
    artifact.viewerScene?.layers
      .filter((layer) => layer.id !== 'house' && layer.id !== 'house_roof_materials')
      .reduce((count, layer) => count + layer.objects.length, 0) ?? 0
  );
}

function isFreestandingPergola(pergola: PergolaObjectModel): boolean {
  if (pergola.attachment) {
    return pergola.attachment.spatialKind === 'freestanding';
  }
  return pergola.connectionKind === 'freestanding' || pergola.strategy === 'none';
}

function resolvePergolaAttachmentHealth(input: {
  projectModel: WorkbenchProjectModel;
  pergola: PergolaObjectModel | null;
}): {
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
  hostAttachmentCode: string | null;
} {
  if (!input.pergola) {
    return { hostAttachmentStatus: 'unknown', hostAttachmentCode: null };
  }
  if (isFreestandingPergola(input.pergola)) {
    return { hostAttachmentStatus: 'freestanding', hostAttachmentCode: null };
  }
  if (input.pergola.attachment) {
    const host = input.pergola.attachment.host;
    if (host?.objectFamily === 'house_forms' && host.objectId && host.edgeId) {
      return { hostAttachmentStatus: 'resolved', hostAttachmentCode: null };
    }
    if (host?.objectFamily === 'pergolas') {
      return { hostAttachmentStatus: 'unresolved', hostAttachmentCode: 'pergola_host_not_supported' };
    }
    return { hostAttachmentStatus: 'unresolved', hostAttachmentCode: 'missing_attachment_host' };
  }
  const resolution = resolveObjectFirstPergolaAttachment({
    houseAssembly: input.projectModel.houseAssembly,
    pergola: input.pergola,
  });
  return {
    hostAttachmentStatus: resolution.status,
    hostAttachmentCode: resolution.code,
  };
}

function resolvePergolaSuppressionReason(input: {
  pergolaId: string | null;
  pergola: PergolaObjectModel | null;
  renderStatus: ProjectPergolaSolveStatus;
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
}): ProjectPergolaRenderSuppressionReason {
  if (!input.pergolaId) return 'missing_pergola_id';
  if (input.renderStatus !== 'geometry_ready') return 'invalid_geometry';
  if (!input.pergola) return 'missing_project_object';
  if (input.hostAttachmentStatus === 'unresolved') return 'unresolved_host';
  return 'none';
}

function planBodyCountByPergolaId(
  shapes: ReadonlyArray<GeometryTopProjectionShape>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shape of shapes) {
    const pergolaId = projectPergolaIdFromShape(shape);
    if (!pergolaId) continue;
    counts.set(pergolaId, (counts.get(pergolaId) ?? 0) + 1);
  }
  return counts;
}

function pergolaHostObjectId(pergola: PergolaObjectModel | null): string | null {
  return pergola?.attachment?.host?.objectId ?? null;
}

function pergolaHostEdgeId(pergola: PergolaObjectModel | null): string | null {
  return pergola?.attachment?.host?.edgeId ?? null;
}

function buildProjectPergolaRenderHealth(input: {
  projectModel: WorkbenchProjectModel;
  pergolaArtifacts: ReadonlyArray<ProjectPergolaRenderArtifact>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): ProjectPergolaRenderHealth[] {
  const pergolaById = new Map(input.projectModel.pergolas.map((pergola) => [pergola.id, pergola]));
  const planCounts = planBodyCountByPergolaId(input.projectPergolaPlanShapes);
  const seenPergolaIds = new Set<string>();
  const health: ProjectPergolaRenderHealth[] = [];

  for (const artifact of input.pergolaArtifacts) {
    const pergolaId = artifact.pergolaId ?? null;
    const healthKey = pergolaId ?? artifact.artifactId;
    if (seenPergolaIds.has(healthKey)) continue;
    seenPergolaIds.add(healthKey);

    const pergola = pergolaId ? pergolaById.get(pergolaId) ?? null : null;
    const rawAttachmentHealth = resolvePergolaAttachmentHealth({
      projectModel: input.projectModel,
      pergola,
    });
    const suppressedCommittedBodyReason = resolvePergolaSuppressionReason({
      pergolaId,
      pergola,
      renderStatus: artifact.renderStatus,
      hostAttachmentStatus: rawAttachmentHealth.hostAttachmentStatus,
    });
    const canRenderCommittedBody = suppressedCommittedBodyReason === 'none';

    health.push({
      pergolaId: pergolaId ?? '',
      artifactId: artifact.artifactId,
      sourceKind: 'object_first_pergola',
      solveStatus: artifact.renderStatus,
      hostObjectId: pergolaHostObjectId(pergola),
      hostEdgeId: pergolaHostEdgeId(pergola),
      attachmentEdgeId: pergola?.attachmentEdgeId ?? null,
      attachmentZoneId: pergola?.attachmentZoneId ?? null,
      hostAttachmentStatus: rawAttachmentHealth.hostAttachmentStatus,
      hostAttachmentCode: rawAttachmentHealth.hostAttachmentCode,
      placementStatus: rawAttachmentHealth.hostAttachmentStatus,
      placementCode: rawAttachmentHealth.hostAttachmentCode,
      planBodyCount: pergolaId ? planCounts.get(pergolaId) ?? 0 : 0,
      sceneBodyCount: countPergolaSceneBodies(artifact),
      canRenderCommittedBody,
      suppressedCommittedBodyReason,
    });
  }

  return health;
}

function renderablePergolaIds(
  health: ReadonlyArray<ProjectPergolaRenderHealth>,
): Set<string> {
  return new Set(
    health
      .filter((entry) => entry.canRenderCommittedBody && entry.pergolaId)
      .map((entry) => entry.pergolaId),
  );
}

function filterCommittedPergolaPlanShapes(input: {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
  health: ReadonlyArray<ProjectPergolaRenderHealth>;
}): GeometryTopProjectionShape[] {
  const allowedIds = renderablePergolaIds(input.health);
  return input.shapes.filter((shape) => {
    const pergolaId = projectPergolaIdFromShape(shape);
    return Boolean(pergolaId && allowedIds.has(pergolaId));
  });
}

function buildProjectPergolaFallbackPlanShapes(input: {
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
  health: ReadonlyArray<ProjectPergolaRenderHealth>;
}): GeometryTopProjectionShape[] {
  const healthByPergolaId = new Map(
    input.health
      .filter((entry) => entry.pergolaId && !entry.canRenderCommittedBody)
      .map((entry) => [entry.pergolaId, entry]),
  );
  return input.projectReferenceShapes
    .filter((shape) => shape.sourceType === 'pergola_reference')
    .filter((shape) => {
      const pergolaId = projectPergolaIdFromShape(shape);
      return Boolean(pergolaId && healthByPergolaId.has(pergolaId));
    })
    .map((shape) => {
      const pergolaId = projectPergolaIdFromShape(shape);
      const health = pergolaId ? healthByPergolaId.get(pergolaId) : null;
      return {
        ...shape,
        metadata: {
          ...(shape.metadata ?? {}),
          ...(pergolaId ? { pergolaId } : {}),
          renderRole: 'diagnostic_fallback',
          fallbackReason: health?.suppressedCommittedBodyReason ?? 'invalid_geometry',
          topProjectionRole: 'context',
        },
      };
    });
}

function buildProjectReferenceShapesFromPergolaArtifacts(
  pergolaArtifacts: ReadonlyArray<ProjectPergolaRenderArtifact>,
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>,
): GeometryTopProjectionShape[] {
  const entries: ProjectPergolaEntry[] = [];
  for (let index = 0; index < pergolaArtifacts.length; index += 1) {
    const artifact = pergolaArtifacts[index]!;
    const assembly: Assembly3D | null = artifact.assembly;
    if (!assembly) continue;
    const pergolaSourceId =
      artifact.pergolaId ?? `pergola-${index + 1}`;
    entries.push({ assembly, pergolaSourceId });
  }
  const shapes: GeometryTopProjectionShape[] =
    entries.length === 0
      ? []
      : buildProjectReferenceShapes({
          pergolas: entries,
          houseSourceId: null,
        }).filter((shape) => shape.sourceType !== 'house_reference');
  const seenPergolaReferenceIds = new Set<string>();
  const dedupedShapes = shapes.filter((shape) => {
    if (shape.sourceType !== 'pergola_reference') return true;
    if (seenPergolaReferenceIds.has(shape.id)) return false;
    seenPergolaReferenceIds.add(shape.id);
    return true;
  });

  const seenHouseReferenceIds = new Set<string>();
  for (const entry of projectHouseGeometries) {
    const shape = entry.referenceShape;
    if (seenHouseReferenceIds.has(shape.id)) continue;
    seenHouseReferenceIds.add(shape.id);
    dedupedShapes.push(shape);
  }

  return dedupedShapes;
}

export function buildProjectObjectRenderPipeline(input: {
  projectModel: WorkbenchProjectModel;
  pergolaArtifacts: ReadonlyArray<ProjectPergolaRenderArtifact>;
  projectHouseGeometries?: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ProjectObjectRenderPipeline {
  const projectHousePipeline: ProjectHouseRenderPipeline = buildProjectHouseRenderPipeline({
    projectModel: input.projectModel,
    projectHouseGeometries: input.projectHouseGeometries,
  });
  const projectHouseGeometries = projectHousePipeline.projectHouseGeometries;
  const projectReferenceShapes = buildProjectReferenceShapesFromPergolaArtifacts(
    input.pergolaArtifacts,
    projectHouseGeometries,
  );
  const rawProjectPergolaPlanShapes = buildProjectPergolaPlanShapesFromPergolaArtifacts(input.pergolaArtifacts);
  const projectPergolaRenderHealth = buildProjectPergolaRenderHealth({
    projectModel: input.projectModel,
    pergolaArtifacts: input.pergolaArtifacts,
    projectPergolaPlanShapes: rawProjectPergolaPlanShapes,
  });
  const projectPergolaPlanShapes = filterCommittedPergolaPlanShapes({
    shapes: rawProjectPergolaPlanShapes,
    health: projectPergolaRenderHealth,
  });
  const projectPergolaFallbackPlanShapes = buildProjectPergolaFallbackPlanShapes({
    projectReferenceShapes,
    health: projectPergolaRenderHealth,
  });
  const projectPlanProjection = buildProjectPlanProjection({
    projectHousePlanShapes: projectHousePipeline.projectHousePlanShapes,
    projectPergolaPlanShapes,
  });
  const projectHouseProjectionHealth = projectHousePipeline.projectHouseProjectionHealth;

  return {
    projectHouseGeometries,
    projectHousePlanShapes: projectHousePipeline.projectHousePlanShapes,
    projectPergolaPlanShapes,
    projectPergolaFallbackPlanShapes,
    projectHouseProjectionHealth,
    projectPergolaRenderHealth,
    houseGeometryInputsById: projectHousePipeline.houseGeometryInputsById,
    projectPlanProjection,
    projectReferenceShapes,
  };
}
