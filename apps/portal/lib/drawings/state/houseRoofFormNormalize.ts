import type { Polygon3 } from '@sp/geometry';
import type {
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
} from './objectFirstWorkbenchModel';

type HouseFootprintLocalPoint = { alongM: string; depthM: string };

/**
 * Roof-form normalisers. Pure helpers translate raw roof-draft and footprint
 * values into the strict types the rest of the object-first roof pipeline
 * expects.
 *
 * Co-located with `localPolygonToGeometryPolygon` because the ridge-axis
 * and validation modules both need to lift the 2D footprint polygon into
 * a 3D `Polygon3` and depend transitively on this module. Placing the
 * helper here keeps ridge-axis derivation independent from UI state.
 *
 * `isBlankString` is duplicated locally rather than imported back from
 * the adapter so this module stays free of upstream cycles. The
 * implementation must stay in lockstep with the adapter copy — see
 * `docs/maintainability-principles.md` "shared logic for shared
 * operations" if a second behaviour ever diverges.
 */
function isBlankString(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

export function localPolygonToGeometryPolygon(
  polygon: HouseFootprintLocalPoint[],
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}

export function normalizeRoofDraftPitch(value: string | null | undefined, fallback: string): string {
  return isBlankString(value) ? fallback : String(value).trim();
}

export function normalizeRoofPrimaryFallDirection(
  value: unknown,
): HouseRoofPrimaryFallDirection | null {
  if (
    value === 'positive_x' ||
    value === 'negative_x' ||
    value === 'positive_y' ||
    value === 'negative_y'
  ) {
    return value;
  }
  return null;
}

export function normalizeRoofRidgeAxis(
  value: unknown,
): HouseRoofRidgeAxis | null {
  return value === 'y' ? 'y' : value === 'x' ? 'x' : null;
}

export function normalizeRoofOpenGableEndIds(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((candidate): candidate is string => typeof candidate === 'string')
      .map((candidate) => candidate.trim())
      .filter((candidate) => candidate.length > 0),
  )];
}

// PR-T8 (2026-05-29): `normalizeAppendageForm` and
// `hasExplicitRoofAppendage` removed with the appendage feature cull.

export function hasExplicitRoofPitch(value: string | null | undefined): boolean {
  return !isBlankString(value);
}
