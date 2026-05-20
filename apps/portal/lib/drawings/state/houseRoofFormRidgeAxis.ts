import {
  deriveHouseGableTerminalEnds,
  preferredMonoFallDirectionForAttachmentSide,
  type Polygon3,
} from '@sp/geometry';
import type {
  CalculatorHouseFootprintMode,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorHouseFootprintPreset,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  HouseRoofFieldSource,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
} from './houseFirstWorkbenchModel';
import { localPolygonToGeometryPolygon } from './houseRoofFormNormalize';

/**
 * Ridge-axis and primary-fall-direction derivation helpers extracted
 * from `houseFirstWorkbenchAdapter`. These predicates classify whether a
 * footprint is orthogonal/rectangular, score gable terminal-end
 * topology, and pick a sensible default ridge axis when the user has
 * not committed an explicit choice.
 *
 * The 1.05 / 1.15 span ratios below are deliberate aspect tolerances —
 * rectangular footprints close to a 1:1 ratio (`hasAmbiguousRidgeAxisSelection`)
 * fall back to the legacy inference instead of forcing a guess that
 * would flip when the user nudges a side by a millimetre. Don't tighten
 * them without re-running the gable-fixture suite.
 */
export type DerivedRoofRidgeAxisResolution = {
  value: HouseRoofRidgeAxis;
  source: Extract<HouseRoofFieldSource, 'default_fallback'>;
  ambiguous: boolean;
  usedFallback: boolean;
};

export function isOrthogonal2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const alongStart = Number(start.alongM);
    const alongEnd = Number(end.alongM);
    const depthStart = Number(start.depthM);
    const depthEnd = Number(end.depthM);
    if (
      !Number.isFinite(alongStart) ||
      !Number.isFinite(alongEnd) ||
      !Number.isFinite(depthStart) ||
      !Number.isFinite(depthEnd)
    ) {
      return false;
    }
    if (Math.abs(alongStart - alongEnd) > 1e-6 && Math.abs(depthStart - depthEnd) > 1e-6) {
      return false;
    }
  }
  return true;
}

export function isRectanglePolygon2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length !== 4 || !isOrthogonal2D(polygon)) return false;
  const along = polygon.map((point) => Number(point.alongM));
  const depth = polygon.map((point) => Number(point.depthM));
  return new Set(along.map((value) => value.toFixed(6))).size === 2 &&
    new Set(depth.map((value) => value.toFixed(6))).size === 2;
}

export function inferLegacyRoofRidgeAxis(input: {
  footprintMode: CalculatorHouseFootprintMode;
  footprintPreset: CalculatorHouseFootprintPreset;
  footprintParams: CalculatorHouseFootprintParams;
  footprintPolygon: CalculatorHouseFootprintPolygonPoint[];
}): HouseRoofRidgeAxis {
  if (input.footprintMode === 'custom_polygon' && isRectanglePolygon2D(input.footprintPolygon)) {
    const alongValues = input.footprintPolygon.map((point) => Number(point.alongM));
    const depthValues = input.footprintPolygon.map((point) => Number(point.depthM));
    const spanAlong = Math.max(...alongValues) - Math.min(...alongValues);
    const spanDepth = Math.max(...depthValues) - Math.min(...depthValues);
    return spanAlong >= spanDepth ? 'x' : 'y';
  }
  if (input.footprintPreset === 'straight') {
    const widthM = Number(input.footprintParams.widthM);
    const bandDepthM = Number(input.footprintParams.bandDepthM);
    if (Number.isFinite(widthM) && Number.isFinite(bandDepthM) && bandDepthM > widthM) {
      return 'y';
    }
  }
  return 'x';
}

export function resolveBoundingFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!polygon.length) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  if (
    alongValues.some((value) => !Number.isFinite(value)) ||
    depthValues.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

export function resolveRectangularFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!isRectanglePolygon2D(polygon)) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

export function hasAmbiguousRidgeAxisSelection(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  const spans = resolveRectangularFootprintSpans(polygon);
  if (!spans) return false;
  const longerSpan = Math.max(spans.alongM, spans.depthM);
  const shorterSpan = Math.min(spans.alongM, spans.depthM);
  if (!(Number.isFinite(longerSpan) && Number.isFinite(shorterSpan)) || shorterSpan <= 0) return false;
  return longerSpan < shorterSpan * 1.15;
}

export function scoreGableTerminalTopology(input: {
  footprint: Polygon3;
  ridgeAxis: HouseRoofRidgeAxis;
}): number {
  return deriveHouseGableTerminalEnds({
    footprint: input.footprint,
    ridgeAxis: input.ridgeAxis,
  }).length;
}

export function resolveDerivedMonoFallDirection(input: {
  attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
}): {
  value: HouseRoofPrimaryFallDirection;
  source: Extract<HouseRoofFieldSource, 'default_fallback'>;
} {
  return {
    value: preferredMonoFallDirectionForAttachmentSide(input.attachmentSide),
    source: 'default_fallback',
  };
}

export function resolveDerivedRidgeAxis(input: {
  footprintMode: CalculatorHouseFootprintMode;
  footprintPreset: CalculatorHouseFootprintPreset;
  footprintParams: CalculatorHouseFootprintParams;
  footprintPolygon: CalculatorHouseFootprintPolygonPoint[];
}): DerivedRoofRidgeAxisResolution {
  const fallback = inferLegacyRoofRidgeAxis(input);
  const rectangularSpans = resolveRectangularFootprintSpans(input.footprintPolygon);
  if (rectangularSpans) {
    if (hasAmbiguousRidgeAxisSelection(input.footprintPolygon)) {
      return {
        value: fallback,
        source: 'default_fallback',
        ambiguous: true,
        usedFallback: true,
      };
    }
    return {
      value: rectangularSpans.alongM >= rectangularSpans.depthM ? 'x' : 'y',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }

  if (!isOrthogonal2D(input.footprintPolygon)) {
    return {
      value: fallback,
      source: 'default_fallback',
      ambiguous: true,
      usedFallback: true,
    };
  }

  const footprint = localPolygonToGeometryPolygon(input.footprintPolygon);
  const xScore = scoreGableTerminalTopology({ footprint, ridgeAxis: 'x' });
  const yScore = scoreGableTerminalTopology({ footprint, ridgeAxis: 'y' });
  if (xScore > yScore) {
    return {
      value: 'x',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }
  if (yScore > xScore) {
    return {
      value: 'y',
      source: 'default_fallback',
      ambiguous: false,
      usedFallback: false,
    };
  }

  const spans = resolveBoundingFootprintSpans(input.footprintPolygon);
  if (spans) {
    if (spans.alongM > spans.depthM * 1.05) {
      return {
        value: 'x',
        source: 'default_fallback',
        ambiguous: false,
        usedFallback: false,
      };
    }
    if (spans.depthM > spans.alongM * 1.05) {
      return {
        value: 'y',
        source: 'default_fallback',
        ambiguous: false,
        usedFallback: false,
      };
    }
  }

  return {
    value: fallback,
    source: 'default_fallback',
    ambiguous: true,
    usedFallback: true,
  };
}
