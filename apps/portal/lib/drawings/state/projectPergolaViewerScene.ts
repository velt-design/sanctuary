import type {
  ViewerSceneLayer,
  ViewerSceneModel,
  ViewerSceneObject,
} from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

type ProjectPergolaViewerSceneSource = {
  moduleInput: Pick<CalculatorModuleInputs, 'pergolaId'>;
  viewerScene: ViewerSceneModel | null;
};

const HOUSE_LAYER_IDS = new Set(['house', 'house_roof_materials']);

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

export function buildProjectPergolaViewerSceneFromModules(input: {
  basisScene: ViewerSceneModel;
  modules: ReadonlyArray<ProjectPergolaViewerSceneSource>;
}): ViewerSceneModel {
  const layerById = new Map<string, ViewerSceneLayer>();
  const layerOrder: string[] = [];

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
      layerById.set(layer.id, cloneLayerWithObjects(layer, [...layer.objects]));
      layerOrder.push(layer.id);
      continue;
    }
    ensureLayer(layer);
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
    },
  };
}
