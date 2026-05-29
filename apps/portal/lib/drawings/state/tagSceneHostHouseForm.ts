import type { ViewerSceneModel } from '@sp/geometry';

export function tagSceneHostHouseForm(
  scene: ViewerSceneModel,
  hostHouseFormId: string | null,
): ViewerSceneModel {
  if (!hostHouseFormId) return scene;
  return {
    ...scene,
    layers: scene.layers.map((layer) => {
      if (layer.id !== 'house') return layer;
      return {
        ...layer,
        objects: layer.objects.map((object) => {
          const metadata = object.metadata as { houseFormId?: string | null } | undefined;
          const existingHouseFormId =
            typeof metadata?.houseFormId === 'string' ? metadata.houseFormId : null;
          const isLegacyHostObject =
            existingHouseFormId === 'host-house' || object.id.startsWith('host-house:');
          if (!isLegacyHostObject) return object;
          return {
            ...object,
            metadata: {
              ...(object.metadata ?? {}),
              houseFormId: hostHouseFormId,
            },
          };
        }),
      };
    }),
  };
}
