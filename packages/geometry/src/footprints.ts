import type { HouseFootprintParams, HouseFootprintPreset, Polygon3 } from './contracts';
import { metresToMillimetres, parseFiniteNumber } from './units';

const DEFAULT_HOUSE_FOOTPRINT_PRESET: HouseFootprintPreset = 'straight';

function makeDefaultHouseFootprintParams(): HouseFootprintParams {
  return {
    bandDepthM: '1.8',
    returnRunM: '2.4',
    recessWidthM: '2.4',
    recessDepthM: '1.2',
    leftLegRunM: '2.4',
    rightLegRunM: '2.4',
    sideRunM: '2.4',
  };
}

type ResolvedHouseFootprintParams = {
  bandDepthM: number;
  returnRunM: number;
  recessWidthM: number;
  recessDepthM: number;
  leftLegRunM: number;
  rightLegRunM: number;
  sideRunM: number;
};

type Point2 = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function point(x: number, y: number): Point2 {
  return { x, y };
}

function normalizePreset(value: HouseFootprintPreset | null | undefined): HouseFootprintPreset {
  if (
    value === 'l_left' ||
    value === 'l_right' ||
    value === 'recess_left' ||
    value === 'recess_right' ||
    value === 'u_shape' ||
    value === 'wrap_left' ||
    value === 'wrap_right'
  ) {
    return value;
  }
  return DEFAULT_HOUSE_FOOTPRINT_PRESET;
}

function normalizeParams(value: HouseFootprintParams | null | undefined): HouseFootprintParams {
  const source: Partial<HouseFootprintParams> = value ?? {};
  const defaults = makeDefaultHouseFootprintParams();
  const pick = (raw: string | undefined, fallback: string) => {
    const trimmed = raw?.trim();
    return trimmed ? trimmed : fallback;
  };

  return {
    bandDepthM: pick(source.bandDepthM, defaults.bandDepthM),
    returnRunM: pick(source.returnRunM, defaults.returnRunM),
    recessWidthM: pick(source.recessWidthM, defaults.recessWidthM),
    recessDepthM: pick(source.recessDepthM, defaults.recessDepthM),
    leftLegRunM: pick(source.leftLegRunM, defaults.leftLegRunM),
    rightLegRunM: pick(source.rightLegRunM, defaults.rightLegRunM),
    sideRunM: pick(source.sideRunM, defaults.sideRunM),
  };
}

function parseFootprintMetres(raw: string | undefined, fallbackM: number): number {
  const parsed = parseFiniteNumber(raw);
  return parsed !== null && parsed > 0 ? parsed : fallbackM;
}

function resolveParams(input: {
  params: HouseFootprintParams;
  pergolaWidthM: number;
  pergolaDepthM: number;
}): ResolvedHouseFootprintParams {
  const pergolaWidthM = Math.max(0.5, input.pergolaWidthM);
  const pergolaDepthM = Math.max(0.5, input.pergolaDepthM);

  const bandDepthM = clamp(parseFootprintMetres(input.params.bandDepthM, 1.8), 0.5, 12);
  const returnRunM = clamp(parseFootprintMetres(input.params.returnRunM, 2.4), 0.5, pergolaDepthM);
  const recessWidthM = clamp(parseFootprintMetres(input.params.recessWidthM, 2.4), 0.5, Math.max(0.5, pergolaWidthM - 0.5));
  const recessDepthM = clamp(parseFootprintMetres(input.params.recessDepthM, 1.2), 0.3, bandDepthM);
  const leftLegRunM = clamp(parseFootprintMetres(input.params.leftLegRunM, 2.4), 0.5, pergolaDepthM);
  const rightLegRunM = clamp(parseFootprintMetres(input.params.rightLegRunM, 2.4), 0.5, pergolaDepthM);
  const sideRunM = clamp(parseFootprintMetres(input.params.sideRunM, 2.4), 0.5, pergolaWidthM);

  return {
    bandDepthM,
    returnRunM,
    recessWidthM,
    recessDepthM,
    leftLegRunM,
    rightLegRunM,
    sideRunM,
  };
}

function toPolygon3(points: Point2[]): Polygon3 {
  return points.map((pt) => ({
    x: metresToMillimetres(pt.x),
    y: metresToMillimetres(pt.y),
    z: 0,
  }));
}

export function buildHouseFootprintPolygon(input: {
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  preset?: HouseFootprintPreset | null;
  params?: HouseFootprintParams | null;
}): Polygon3 {
  const width = Math.max(0.5, input.pergolaWidthMm / 1000);
  const depth = Math.max(0.5, input.pergolaDepthMm / 1000);
  const preset = normalizePreset(input.preset);
  const params = normalizeParams(input.params);
  const resolved = resolveParams({
    params,
    pergolaWidthM: width,
    pergolaDepthM: depth,
  });

  const bandDepth = resolved.bandDepthM;
  const returnRun = resolved.returnRunM;
  const recessWidth = resolved.recessWidthM;
  const recessDepth = resolved.recessDepthM;
  const leftLegRun = resolved.leftLegRunM;
  const rightLegRun = resolved.rightLegRunM;
  const sideRun = resolved.sideRunM;
  const totalRecessDepth = bandDepth + recessDepth;

  if (preset === 'recess_left' || preset === 'recess_right') {
    if (preset === 'recess_left') {
      return toPolygon3([
        point(0, -totalRecessDepth),
        point(width, -totalRecessDepth),
        point(width, 0),
        point(recessWidth, 0),
        point(recessWidth, -recessDepth),
        point(0, -recessDepth),
      ]);
    }

    return toPolygon3([
      point(0, -totalRecessDepth),
      point(width, -totalRecessDepth),
      point(width, -recessDepth),
      point(width - recessWidth, -recessDepth),
      point(width - recessWidth, 0),
      point(0, 0),
    ]);
  }

  if (preset === 'straight') {
    return toPolygon3([point(0, -bandDepth), point(width, -bandDepth), point(width, 0), point(0, 0)]);
  }

  if (preset === 'l_left') {
    return toPolygon3([
      point(-bandDepth, -bandDepth),
      point(width, -bandDepth),
      point(width, 0),
      point(0, 0),
      point(0, returnRun),
      point(-bandDepth, returnRun),
    ]);
  }

  if (preset === 'l_right') {
    return toPolygon3([
      point(0, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, returnRun),
      point(width, returnRun),
      point(width, 0),
      point(0, 0),
    ]);
  }

  if (preset === 'u_shape') {
    return toPolygon3([
      point(-bandDepth, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, rightLegRun),
      point(width, rightLegRun),
      point(width, 0),
      point(0, 0),
      point(0, leftLegRun),
      point(-bandDepth, leftLegRun),
    ]);
  }

  if (preset === 'wrap_left') {
    return toPolygon3([
      point(-bandDepth, -bandDepth),
      point(width, -bandDepth),
      point(width, 0),
      point(0, 0),
      point(0, depth),
      point(sideRun, depth),
      point(sideRun, depth + bandDepth),
      point(-bandDepth, depth + bandDepth),
    ]);
  }

  if (preset === 'wrap_right') {
    return toPolygon3([
      point(0, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, depth + bandDepth),
      point(width - sideRun, depth + bandDepth),
      point(width - sideRun, depth),
      point(width, depth),
      point(width, 0),
      point(0, 0),
    ]);
  }

  return toPolygon3([point(0, -bandDepth), point(width, -bandDepth), point(width, 0), point(0, 0)]);
}
