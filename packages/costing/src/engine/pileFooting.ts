import { isCostingManifestAtLeast } from '../manifestVersion';
import type { CostingConfigV1 } from './config';
import type { InputsNormalizedV1, MaterialsLineV1 } from './types';

// Owner approved 400mm diameter x 1.5m deep, with 100mm concrete beneath the post.
export const PILE_POST_EMBEDMENT_M = 1.4;
export const PILE_INSTALL_MINUTES = 120;

export function usesApprovedPileFooting(inputs: InputsNormalizedV1, config: CostingConfigV1): boolean {
  return inputs.post_connection_type === 'pile_1_5m' && isCostingManifestAtLeast(config, 2, 9);
}

export function pileFootingMaterials(postCount: number): MaterialsLineV1[] {
  return [
    ['concrete', 'Concrete for 400mm x 1.5m post pile (including waste)', 175],
    ['excavation', 'Post pile auger and spoil allowance', 50],
    ['consumables', 'Post pile bracing, protection and consumables', 25],
  ].map(([key, label, cost]) => ({
    id: `foundation.pile_1_5m.${key}`, label: String(label), unit: 'post', qty: postCount,
    unit_cost_ex_gst: Number(cost), line_cost_ex_gst: Math.round(postCount * Number(cost) * 100) / 100,
    notes: 'Owner-approved allowance. Extra buried post stock is included in post cutting, not charged again here.',
  }));
}
