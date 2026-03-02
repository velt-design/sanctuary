import bomStrategyJson from '../config/bom/bom_strategy_v1.json';
import hardwareJson from '../config/hardware/hardware_placeholders_v1.json';
import installActionsJson from '../config/install_actions_v1.6_2026-03-02.json';
import manifestJson from '../config/costing_manifest_v1.6_2026-03-02.json';
import materialsAdditionsJson from '../config/materials/sanctuary_materials_additions_v1_2026-01-08.json';
import materialsJson from '../config/materials/sanctuary_pricebook_materials_2025-11_exgst_v1.1.json';
import overheadsJson from '../config/overheads_v1.1_2026-01-08.json';
import costingRulesJson from '../config/costing_rules_v1.3_2026-01-08.json';

export const ACTIVE_COSTING_MANIFEST_PATH = 'packages/costing/src/config/costing_manifest_v1.6_2026-03-02.json' as const;

export type CostingManifestV1 = typeof manifestJson;
export type MaterialsPricebookV1 = typeof materialsJson;
export type HardwarePlaceholdersV1 = typeof hardwareJson;
export type BomStrategyV1 = typeof bomStrategyJson;
export type InstallActionsV1 = typeof installActionsJson;
export type OverheadsV1 = typeof overheadsJson;
export type CostingRulesV1 = typeof costingRulesJson;

export type CostingConfigV1 = {
  manifest: CostingManifestV1;
  materials: MaterialsPricebookV1;
  hardware: HardwarePlaceholdersV1;
  bomStrategy: BomStrategyV1;
  installActions: InstallActionsV1;
  overheads: OverheadsV1;
  rules: CostingRulesV1;
};

const EXPECTED_FILES = {
  pricebook_materials: 'materials/sanctuary_pricebook_materials_2025-11_exgst_v1.1.json',
  materials_additions: 'materials/sanctuary_materials_additions_v1_2026-01-08.json',
  hardware_placeholders: 'hardware/hardware_placeholders_v1.json',
  install_actions: 'install_actions_v1.6_2026-03-02.json',
  bom_strategy: 'bom/bom_strategy_v1.json',
  overheads: 'overheads_v1.1_2026-01-08.json',
  costing_rules: 'costing_rules_v1.3_2026-01-08.json',
} as const;

export function loadCostingConfigV1(): CostingConfigV1 {
  const active = manifestJson.files;
  const mismatches: string[] = [];

  (Object.keys(EXPECTED_FILES) as Array<keyof typeof EXPECTED_FILES>).forEach((key) => {
    const expected = EXPECTED_FILES[key];
    const actual = active[key];
    if (actual !== expected) mismatches.push(`${key}: expected '${expected}' but manifest points to '${actual}'`);
  });

  if (mismatches.length) {
    throw new Error(
      [
        'Costing manifest files do not match the currently imported config files.',
        ...mismatches,
        'Update imports in packages/costing/src/engine/config.ts to include the new versioned JSONs.',
      ].join('\n'),
    );
  }

  const mergedMaterials: MaterialsPricebookV1 = {
    ...materialsJson,
    items: [...materialsJson.items],
  };
  const baseIndex = new Map<string, number>(materialsJson.items.map((item, idx) => [item.id, idx]));
  const additions = (materialsAdditionsJson as unknown as { items?: Array<MaterialsPricebookV1['items'][number]> }).items ?? [];
  for (const item of additions) {
    const idx = baseIndex.get(item.id);
    if (idx === undefined) mergedMaterials.items.push(item);
    else mergedMaterials.items[idx] = item;
  }

  return {
    manifest: manifestJson,
    materials: mergedMaterials,
    hardware: hardwareJson,
    bomStrategy: bomStrategyJson,
    installActions: installActionsJson,
    overheads: overheadsJson,
    rules: costingRulesJson,
  };
}
