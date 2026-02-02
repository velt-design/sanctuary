import { loadCostingConfigV1, type CostingConfigV1 } from './config';
import { normaliseColour, normaliseProfile } from './normalise';

type PricebookItem = CostingConfigV1['materials']['items'][number];

/**
 * Debug helper: finds an aluminium extrusion pricebook bar by attributes.
 * - Normalises profile (× → x, removes spaces)
 * - Normalises colour (case + matte/matt black → black)
 * - Matches by attributes (profile/colour/length_m), not by name
 */
export function findPricebookExtrusion(
  profile: string,
  colour: string,
  length_m: number,
  config?: Pick<CostingConfigV1, 'materials'>,
): PricebookItem | null {
  const cfg = config ?? loadCostingConfigV1();

  const targetProfile = normaliseProfile(profile);
  const targetColour = normaliseColour(colour);
  const targetLen = Number(length_m);
  if (!Number.isFinite(targetLen) || targetLen <= 0) return null;

  for (const item of cfg.materials.items) {
    if (item.category !== 'aluminium_extrusion' || item.unit !== 'bar') continue;
    const attrs = item.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const itemProfile = typeof attrs.profile === 'string' ? attrs.profile : '';
    const itemColour = typeof attrs.colour === 'string' ? attrs.colour : '';
    const itemLen = typeof attrs.length_m === 'number' ? attrs.length_m : Number.NaN;

    if (normaliseProfile(itemProfile) !== targetProfile) continue;
    if (normaliseColour(itemColour) !== targetColour) continue;
    if (!Number.isFinite(itemLen) || Math.abs(itemLen - targetLen) > 1e-6) continue;

    return item as PricebookItem;
  }

  return null;
}
