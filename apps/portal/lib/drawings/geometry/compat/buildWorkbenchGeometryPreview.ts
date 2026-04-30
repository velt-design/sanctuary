import {
  buildViewerSceneModel,
  type Assembly3D,
  type GeometryConfig,
  validateGeometrySolve,
  type GeometryValidationReport,
  type ViewerSceneModel,
} from '@sp/geometry';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { deriveWorkbenchGeometry } from './deriveWorkbenchGeometry';
import { coerceHiddenWorkbenchGableBaseline } from '../hiddenWorkbenchGableBaseline';
import { resolveWorkbenchGeometryModule } from '../resolveWorkbenchGeometryModule';
import type { WorkbenchProjectModel } from '../../state/objectFirstWorkbenchModel';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from '../../state/deckSupportDiagnostics';
import {
  buildObjectWorkbenchGeometryContext,
  type ObjectWorkbenchGeometryContext,
} from './objectWorkbenchGeometryContext';

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

export function buildWorkbenchGeometryPreview(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
  objectWorkbenchProjectModel?: WorkbenchProjectModel | null;
}): GeometryPreviewState {
  const geometryContext = buildObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
    projectModel: input.objectWorkbenchProjectModel,
  });
  const resolved = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.moduleIndex,
  });
  const previewMode = resolvePreviewMode({
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
  });

  if (!resolved.ok) {
    return {
      kind: 'error',
      message: resolved.message.replace('workbench geometry', '3D geometry preview'),
    };
  }

  const geometryModule = coerceHiddenWorkbenchGableBaseline(resolved.module);
  const deckSupport = buildWorkbenchDeckSupportDiagnostic({
    activeHostSide: resolveWorkbenchDeckSupportActiveSide(geometryModule),
    decks: geometryContext.house?.decks ?? [],
  });

  if (geometryContext.house?.roof.validation.status === 'invalid') {
    return {
      kind: 'unsupported',
      previewMode,
      deckSupport,
      message:
        geometryContext.house.roof.validation.message ??
        'The selected house roof configuration is not supported by Sanctuary geometry V1.',
    };
  }

  const derivation = deriveWorkbenchGeometry({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    moduleId: `module-${input.moduleIndex + 1}`,
    module: geometryModule,
    result: resolved.moduleResult,
    objectWorkbenchGeometryContext: geometryContext,
  });
  if (derivation.kind === 'legacy_unsupported_family') {
    return {
      kind: 'unsupported',
      previewMode,
      deckSupport,
      message: derivation.message,
    };
  }

  if (derivation.kind === 'invalid_geometry') {
    return {
      kind: 'error',
      message: derivation.message,
    };
  }

  const validation = validateGeometrySolve({
    config: derivation.config,
    solveResult: {
      ok: true,
      value: derivation.assembly,
    },
  });

  return {
    kind: 'ready',
    previewMode,
    resultSource: resolved.resultSource,
    config: derivation.config,
    assembly: derivation.assembly,
    validation,
    scene: annotateSceneAttachmentZoneMetadata(
      annotateSceneHostEdgeSides(
        buildViewerSceneModel(derivation.assembly),
        geometryContext.house?.footprint.polygon,
      ),
      geometryContext,
    ),
    deckSupport,
  };
}
