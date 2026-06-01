import type {
  GeometryTopProjectionShape,
  HouseModel3D,
  Line3,
  ViewerSceneLayer,
  ViewerSceneModel,
  ViewerSceneObject,
} from '@sp/geometry';
import {
  buildHouseModelRoofMaterialSceneObjects,
  buildHouseModelSceneObjects,
} from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

type ProjectPergolaViewerSceneSource = {
  moduleInput: Pick<CalculatorModuleInputs, 'pergolaId'>;
  viewerScene: ViewerSceneModel | null;
};

const HOUSE_LAYER_IDS = new Set(['house', 'house_roof_materials']);

type ProjectHouseViewerSceneSource = {
  houseFormId: string;
  model: HouseModel3D;
};

type ProjectPergolaRenderHealthEntry = {
  pergolaId?: string;
  canRenderCommittedBody?: boolean;
  suppressedCommittedBodyReason?: string;
};

function projectPergolaSceneObjectIdPrefix(pergolaId: string): string {
  return `project_pergola:${pergolaId}:`;
}

function objectSourceId(object: ViewerSceneObject): string | null {
  if ('sourceId' in object && typeof object.sourceId === 'string') {
    return object.sourceId;
  }
  return typeof object.metadata?.sourceId === 'string' ? object.metadata.sourceId : null;
}

function prefixProjectPergolaSceneObject(
  object: ViewerSceneObject,
  pergolaId: string,
): ViewerSceneObject {
  const prefix = projectPergolaSceneObjectIdPrefix(pergolaId);
  const id = object.id.startsWith(prefix) ? object.id : `${prefix}${object.id}`;
  const existingSourceId = objectSourceId(object);
  return {
    ...object,
    id,
    metadata: {
      ...(object.metadata ?? {}),
      ...(existingSourceId ? { sourceId: existingSourceId } : {}),
      pergolaId,
    },
  } as ViewerSceneObject;
}

function cloneLayerWithObjects(
  layer: ViewerSceneLayer,
  objects: ViewerSceneObject[],
): ViewerSceneLayer {
  return {
    ...layer,
    objects,
  };
}

function sortSceneObjects(objects: ViewerSceneObject[]): ViewerSceneObject[] {
  return [...objects].sort((a, b) => a.id.localeCompare(b.id));
}

function projectPergolaIdFromShape(shape: GeometryTopProjectionShape): string | null {
  const taggedPergolaId =
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null;
  return taggedPergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? null;
}

function finiteZ(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildPergolaFallbackLine(input: {
  id: string;
  pergolaId: string;
  reason: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  z: number;
}): ViewerSceneObject {
  const line: Line3 = {
    start: { x: input.start.x, y: input.start.y, z: input.z },
    end: { x: input.end.x, y: input.end.y, z: input.z },
  };
  return {
    id: input.id,
    type: 'reference_line',
    sourceId: input.pergolaId,
    kind: 'attachment_edge',
    line,
    metadata: {
      pergolaId: input.pergolaId,
      renderRole: 'diagnostic_fallback',
      fallbackReason: input.reason,
      sourceId: input.pergolaId,
    },
  };
}

function buildProjectPergolaFallbackSceneLayer(input: {
  fallbackPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealthEntry>;
}): ViewerSceneLayer | null {
  const healthByPergolaId = new Map(
    (input.projectPergolaRenderHealth ?? [])
      .filter((entry) => entry.pergolaId && entry.canRenderCommittedBody === false)
      .map((entry) => [entry.pergolaId!, entry]),
  );
  const objects: ViewerSceneObject[] = [];
  for (const shape of input.fallbackPlanShapes) {
    const pergolaId = projectPergolaIdFromShape(shape);
    if (!pergolaId) continue;
    const reason =
      (typeof shape.metadata?.fallbackReason === 'string' ? shape.metadata.fallbackReason : null) ??
      healthByPergolaId.get(pergolaId)?.suppressedCommittedBodyReason ??
      'invalid_geometry';
    const polygon = shape.polygon.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    );
    if (polygon.length < 2) continue;
    const z = finiteZ(shape.zMax) ?? finiteZ(shape.zMin) ?? 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      objects.push(
        buildPergolaFallbackLine({
          id: `project_pergola_fallback:${pergolaId}:edge-${index + 1}`,
          pergolaId,
          reason,
          start,
          end,
          z,
        }),
      );
    }
  }
  if (objects.length === 0) return null;
  return {
    id: 'project_pergola_fallbacks',
    label: 'Pergola Diagnostic Fallbacks',
    visibleByDefault: true,
    objects: sortSceneObjects(objects),
  };
}

function buildProjectHouseSceneLayerById(
  projectHouseGeometries: ReadonlyArray<ProjectHouseViewerSceneSource>,
): Map<string, ViewerSceneLayer> {
  const houseObjects: ViewerSceneObject[] = [];
  const houseRoofMaterialObjects: ViewerSceneObject[] = [];

  for (const entry of projectHouseGeometries) {
    houseObjects.push(
      ...buildHouseModelSceneObjects({
        model: entry.model,
        attachmentTarget: null,
      }),
    );
    houseRoofMaterialObjects.push(
      ...buildHouseModelRoofMaterialSceneObjects({
        model: entry.model,
      }),
    );
  }

  const layerById = new Map<string, ViewerSceneLayer>();
  if (houseObjects.length > 0) {
    layerById.set('house', {
      id: 'house',
      label: 'House',
      visibleByDefault: true,
      objects: sortSceneObjects(houseObjects),
    });
  }
  if (houseRoofMaterialObjects.length > 0) {
    layerById.set('house_roof_materials', {
      id: 'house_roof_materials',
      label: 'House Roof Materials',
      visibleByDefault: true,
      objects: sortSceneObjects(houseRoofMaterialObjects),
    });
  }
  return layerById;
}

export function buildProjectPergolaViewerSceneFromModules(input: {
  basisScene: ViewerSceneModel;
  modules: ReadonlyArray<ProjectPergolaViewerSceneSource>;
  projectHouseGeometries: ReadonlyArray<ProjectHouseViewerSceneSource>;
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealthEntry>;
  projectPergolaFallbackPlanShapes?: ReadonlyArray<GeometryTopProjectionShape>;
}): ViewerSceneModel {
  const layerById = new Map<string, ViewerSceneLayer>();
  const layerOrder: string[] = [];
  const projectHouseLayerById = buildProjectHouseSceneLayerById(input.projectHouseGeometries);

  const ensureLayer = (layer: ViewerSceneLayer): ViewerSceneLayer => {
    const existing = layerById.get(layer.id);
    if (existing) return existing;
    const next = cloneLayerWithObjects(layer, []);
    layerById.set(layer.id, next);
    layerOrder.push(layer.id);
    return next;
  };

  for (const layer of input.basisScene.layers) {
    if (HOUSE_LAYER_IDS.has(layer.id)) {
      const projectHouseLayer = projectHouseLayerById.get(layer.id);
      if (projectHouseLayer) {
        layerById.set(layer.id, projectHouseLayer);
        layerOrder.push(layer.id);
      }
      continue;
    }
    ensureLayer(layer);
  }

  for (const [layerId, layer] of projectHouseLayerById) {
    if (layerById.has(layerId)) continue;
    layerById.set(layerId, layer);
    layerOrder.push(layerId);
  }

  const fallbackLayer = buildProjectPergolaFallbackSceneLayer({
    fallbackPlanShapes: input.projectPergolaFallbackPlanShapes ?? [],
    projectPergolaRenderHealth: input.projectPergolaRenderHealth,
  });
  if (fallbackLayer) {
    layerById.set(fallbackLayer.id, fallbackLayer);
    layerOrder.push(fallbackLayer.id);
  }

  const seenPergolaIds = new Set<string>();
  for (const module of input.modules) {
    const pergolaId = module.moduleInput.pergolaId;
    if (!pergolaId || seenPergolaIds.has(pergolaId) || !module.viewerScene) continue;
    seenPergolaIds.add(pergolaId);

    for (const layer of module.viewerScene.layers) {
      if (HOUSE_LAYER_IDS.has(layer.id)) continue;
      const targetLayer = ensureLayer(layer);
      targetLayer.objects.push(
        ...layer.objects.map((object) =>
          prefixProjectPergolaSceneObject(object, pergolaId),
        ),
      );
    }
  }

  return {
    layers: layerOrder.map((id) => layerById.get(id)!).filter((layer) => layer.objects.length > 0),
    metadata: {
      ...(input.basisScene.metadata ?? {}),
      projectPergolaSceneCount: seenPergolaIds.size,
      projectPergolaSceneIds: Array.from(seenPergolaIds).join(','),
      projectPergolaFallbackIds: Array.from(
        new Set(
          (input.projectPergolaFallbackPlanShapes ?? [])
            .map(projectPergolaIdFromShape)
            .filter((pergolaId): pergolaId is string => Boolean(pergolaId)),
        ),
      ).join(','),
      projectPergolaRenderHealth: JSON.stringify(input.projectPergolaRenderHealth ?? []),
    },
  };
}
