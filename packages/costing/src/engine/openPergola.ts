import type { RoofMaterial } from './types';

export const OPEN_PERGOLA_DEFAULT_PROFILE = '150x50';
const OPEN_PERGOLA_DEFAULT_RAFTER_SPACING_MM = 500;

export function isOpenPergolaRoof(material: RoofMaterial): boolean {
  return material === 'none';
}

export function calculateOpenPergolaRafterLayout(
  lengthMmRaw: number,
  targetSpacingMmRaw: unknown,
): { rafterCount: number; bayCount: number; clearLenMm: number } {
  const lengthMm = Number.isFinite(lengthMmRaw) ? Math.max(0, lengthMmRaw) : 0;
  const parsedSpacing = Number.parseFloat(String(targetSpacingMmRaw ?? ''));
  const targetSpacingMm = Number.isFinite(parsedSpacing) && parsedSpacing > 0
    ? parsedSpacing
    : OPEN_PERGOLA_DEFAULT_RAFTER_SPACING_MM;
  const bayCount = Math.max(1, Math.ceil(lengthMm / targetSpacingMm));
  return { rafterCount: bayCount + 1, bayCount, clearLenMm: lengthMm };
}
