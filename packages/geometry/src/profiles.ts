import type { AssemblyMemberProfile } from './contracts';
import { parseFiniteNumber } from './units';

function rectangularProfile(widthMm: number, depthMm: number): AssemblyMemberProfile {
  return {
    shape: 'rectangular',
    widthMm,
    depthMm,
  };
}

export function parseAssemblyMemberProfile(value: string | null | undefined): AssemblyMemberProfile | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const profileMatch = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (profileMatch) {
    const a = parseFiniteNumber(profileMatch[1]);
    const b = parseFiniteNumber(profileMatch[2]);
    if (a !== null && b !== null && a > 0 && b > 0) {
      return rectangularProfile(Math.round(Math.min(a, b)), Math.round(Math.max(a, b)));
    }
  }

  const normalized = text.toLowerCase();
  if (normalized.includes('sp gutter') || normalized === 'sp_gutter') {
    return rectangularProfile(100, 150);
  }
  if (normalized.includes('box_gutter_100x100') || normalized.includes('box gutter 100x100')) {
    return rectangularProfile(100, 100);
  }

  return null;
}
