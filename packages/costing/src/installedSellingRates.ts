import { getDefaultBlindSellingRates } from './blinds';
import { getDefaultRafterLightingRates } from './lighting';

/** These are installed selling schedules, not supply costs to mark up again. */
export type BlindSellingRates = {
  ziptrakBaseExGst: number[][];
  omniBaseExGst: number[][];
  fabricMultipliers: { MESH: number; PVC: number; FINE_MESH: number };
  coreSellMultiplier: number;
  motorIncCents: number;
  coverIncCentsPerM: { NONE: number; FLASHING: number; PELMET: number };
};
export type RafterLightingRates = {
  startupIncCents: number; lightIncCents: number; dimmerIncCents: number;
  extraDriverIncCents: number; standardDriverCapacity: number; dimmedDriverCapacity: number;
};
export type InstalledSellingRates = { blinds: BlindSellingRates; rafterLighting: RafterLightingRates };

/** Explicit draft action only; never automatically seed an older published version. */
export function getDefaultInstalledSellingRates(): InstalledSellingRates {
  return { blinds: getDefaultBlindSellingRates(), rafterLighting: getDefaultRafterLightingRates() };
}

export function validateInstalledSellingRates(value: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  const visit = (candidate: unknown, expected: unknown, path: string) => {
    if (typeof expected === 'number') {
      const multiplier = path.includes('Multiplier');
      const capacity = path.endsWith('Capacity');
      const integer = capacity || path.includes('IncCents');
      const positive = multiplier || capacity || path.includes('BaseExGst');
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)
        || (positive ? candidate <= 0 : candidate < 0)
        || candidate > (multiplier ? 5 : capacity ? 1000 : 100_000_000)
        || (integer && !Number.isSafeInteger(candidate))
        || (path.endsWith('.NONE') && candidate !== 0)) {
        issues.push({ path, message: 'Enter a valid schedule rate. Cents and driver capacities must be whole numbers; uncovered blinds have no cover charge.' });
      }
      return;
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(candidate) || candidate.length !== expected.length) {
        issues.push({ path, message: 'Keep the supported blind size bands and provide every rate.' }); return;
      }
      expected.forEach((item, index) => visit(candidate[index], item, `${path}.${index}`)); return;
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      issues.push({ path, message: 'Provide the complete installed selling schedule.' }); return;
    }
    const schema = expected as Record<string, unknown>, record = candidate as Record<string, unknown>;
    for (const key of Object.keys(record)) if (!Object.prototype.hasOwnProperty.call(schema, key)) issues.push({ path: `${path}.${key}`, message: 'Unsupported schedule field.' });
    for (const [key, child] of Object.entries(schema)) visit(record[key], child, `${path}.${key}`);
  };
  visit(value, getDefaultInstalledSellingRates(), 'installedSellingRates');
  return issues;
}
