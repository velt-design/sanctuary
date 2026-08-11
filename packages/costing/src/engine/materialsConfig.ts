import materialsAdditionsJson from '../config/materials/sanctuary_materials_additions_v1_2026-01-08.json';
import materialsJson from '../config/materials/sanctuary_pricebook_materials_2025-11_exgst_v1.1.json';
import powdercoatAdditionsJson from '../config/materials/sanctuary_powdercoat_additions_v1_2026-08-11.json';

export type MaterialsPricebookV1 = typeof materialsJson;

export function loadCostingMaterialsV1(): MaterialsPricebookV1 {
  const mergedMaterials: MaterialsPricebookV1 = {
    ...materialsJson,
    items: [...materialsJson.items],
  };
  const baseIndex = new Map<string, number>(materialsJson.items.map((item, index) => [item.id, index]));
  const mergeItems = (source: unknown) => {
    const additions = (source as { items?: Array<MaterialsPricebookV1['items'][number]> }).items ?? [];
    for (const item of additions) {
      const index = baseIndex.get(item.id);
      if (index === undefined) {
        baseIndex.set(item.id, mergedMaterials.items.length);
        mergedMaterials.items.push(item);
      } else {
        mergedMaterials.items[index] = item;
      }
    }
  };

  mergeItems(materialsAdditionsJson);
  mergeItems(powdercoatAdditionsJson);

  return mergedMaterials;
}
