import type {
  AttachmentSide,
  HouseFootprintParams,
  HouseFootprintPolygonPointInput,
  HouseFootprintPreset,
  Line3,
  Point3,
  Polygon3,
} from './contracts';
import { metresToMillimetres, parseFiniteNumber } from './units';

const DEFAULT_HOUSE_FOOTPRINT_PRESET: HouseFootprintPreset = 'straight';
const EPSILON = 1e-6;

function makeDefaultHouseFootprintParams(): HouseFootprintParams {
  return {
    widthM: '',
    offsetXM: '0',
    setbackM: '0',
    bandDepthM: '1.8',
    returnRunM: '2.4',
    recessWidthM: '2.4',
    recessDepthM: '1.2',
    leftLegRunM: '2.4',
    rightLegRunM: '2.4',
    sideRunM: '2.4',
  };
}

export type ResolvedHouseFootprintParams = {
  widthM: number;
  offsetXM: number;
  setbackM: number;
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

export type HouseFootprintSideLocalPoint = {
  alongM: number;
  depthM: number;
};

export type HouseFootprintFrame = {
  attachmentSide: AttachmentSide;
  pergolaWidthM: number;
  pergolaDepthM: number;
  alongWidthM: number;
  perpendicularDepthM: number;
};

export type HouseFootprintPolygonResult =
  | {
      ok: true;
      polygon: Polygon3;
      sideLocalPoints: HouseFootprintSideLocalPoint[];
    }
  | {
      ok: false;
      error: string;
    };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function point(x: number, y: number): Point2 {
  return { x, y };
}

function normalizeAttachmentSide(value: AttachmentSide | null | undefined): AttachmentSide {
  if (value === 'front' || value === 'left' || value === 'right') return value;
  return 'rear';
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
    widthM: pick(source.widthM, defaults.widthM),
    offsetXM: pick(source.offsetXM, defaults.offsetXM),
    setbackM: pick(source.setbackM, defaults.setbackM),
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

function parseFootprintOffsetMetres(raw: string | undefined, fallbackM: number): number {
  const parsed = parseFiniteNumber(raw);
  return parsed !== null ? parsed : fallbackM;
}

export function resolveHouseFootprintFrame(input: {
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  attachmentSide?: AttachmentSide | null;
}): HouseFootprintFrame {
  const pergolaWidthM = Math.max(0.5, input.pergolaWidthMm / 1000);
  const pergolaDepthM = Math.max(0.5, input.pergolaDepthMm / 1000);
  const attachmentSide = normalizeAttachmentSide(input.attachmentSide);
  return {
    attachmentSide,
    pergolaWidthM,
    pergolaDepthM,
    alongWidthM: attachmentSide === 'left' || attachmentSide === 'right' ? pergolaDepthM : pergolaWidthM,
    perpendicularDepthM: attachmentSide === 'left' || attachmentSide === 'right' ? pergolaWidthM : pergolaDepthM,
  };
}

function resolveParams(input: {
  params: HouseFootprintParams;
  pergolaWidthM: number;
  pergolaDepthM: number;
}): ResolvedHouseFootprintParams {
  const pergolaWidthM = Math.max(0.5, input.pergolaWidthM);
  const pergolaDepthM = Math.max(0.5, input.pergolaDepthM);

  const widthM = clamp(parseFootprintMetres(input.params.widthM, pergolaWidthM), 0.5, 30);
  const offsetXM = parseFootprintOffsetMetres(input.params.offsetXM, 0);
  const setbackM = Math.max(0, parseFootprintOffsetMetres(input.params.setbackM, 0));
  const bandDepthM = clamp(parseFootprintMetres(input.params.bandDepthM, 1.8), 0.5, 12);
  const returnRunM = clamp(parseFootprintMetres(input.params.returnRunM, 2.4), 0.5, pergolaDepthM);
  const recessWidthM = clamp(parseFootprintMetres(input.params.recessWidthM, 2.4), 0.5, Math.max(0.5, widthM - 0.5));
  const recessDepthM = clamp(parseFootprintMetres(input.params.recessDepthM, 1.2), 0.3, bandDepthM);
  const leftLegRunM = clamp(parseFootprintMetres(input.params.leftLegRunM, 2.4), 0.5, pergolaDepthM);
  const rightLegRunM = clamp(parseFootprintMetres(input.params.rightLegRunM, 2.4), 0.5, pergolaDepthM);
  const sideRunM = clamp(parseFootprintMetres(input.params.sideRunM, 2.4), 0.5, widthM);

  return {
    widthM,
    offsetXM,
    setbackM,
    bandDepthM,
    returnRunM,
    recessWidthM,
    recessDepthM,
    leftLegRunM,
    rightLegRunM,
    sideRunM,
  };
}

function presetPointToSideLocal(pt: Point2): HouseFootprintSideLocalPoint {
  return {
    alongM: pt.x,
    depthM: -pt.y,
  };
}

export function houseFootprintSideLocalPointToWorld(input: {
  point: HouseFootprintSideLocalPoint;
  frame: HouseFootprintFrame;
  resolved: ResolvedHouseFootprintParams;
}): Point3 {
  const along = input.point.alongM + input.resolved.offsetXM;
  const depth = input.point.depthM;

  if (input.frame.attachmentSide === 'front') {
    return {
      x: metresToMillimetres(along),
      y: metresToMillimetres(input.frame.pergolaDepthM + input.resolved.setbackM + depth),
      z: 0,
    };
  }

  if (input.frame.attachmentSide === 'left') {
    return {
      x: metresToMillimetres(-input.resolved.setbackM - depth),
      y: metresToMillimetres(along),
      z: 0,
    };
  }

  if (input.frame.attachmentSide === 'right') {
    return {
      x: metresToMillimetres(input.frame.pergolaWidthM + input.resolved.setbackM + depth),
      y: metresToMillimetres(along),
      z: 0,
    };
  }

  return {
    x: metresToMillimetres(along),
    y: metresToMillimetres(-input.resolved.setbackM - depth),
    z: 0,
  };
}

export function houseFootprintSideLocalToWorldPolygon(input: {
  points: HouseFootprintSideLocalPoint[];
  frame: HouseFootprintFrame;
  resolved: ResolvedHouseFootprintParams;
}): Polygon3 {
  return input.points.map((point) =>
    houseFootprintSideLocalPointToWorld({
      point,
      frame: input.frame,
      resolved: input.resolved,
    }),
  );
}

export function buildHouseSideAttachmentLine(input: {
  attachmentSide?: AttachmentSide | null;
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  zMm: number;
}): Line3 {
  const frame = resolveHouseFootprintFrame(input);
  if (frame.attachmentSide === 'front') {
    return {
      start: { x: 0, y: metresToMillimetres(frame.pergolaDepthM), z: input.zMm },
      end: { x: metresToMillimetres(frame.pergolaWidthM), y: metresToMillimetres(frame.pergolaDepthM), z: input.zMm },
    };
  }

  if (frame.attachmentSide === 'left') {
    return {
      start: { x: 0, y: 0, z: input.zMm },
      end: { x: 0, y: metresToMillimetres(frame.pergolaDepthM), z: input.zMm },
    };
  }

  if (frame.attachmentSide === 'right') {
    return {
      start: { x: metresToMillimetres(frame.pergolaWidthM), y: 0, z: input.zMm },
      end: { x: metresToMillimetres(frame.pergolaWidthM), y: metresToMillimetres(frame.pergolaDepthM), z: input.zMm },
    };
  }

  return {
    start: { x: 0, y: 0, z: input.zMm },
    end: { x: metresToMillimetres(frame.pergolaWidthM), y: 0, z: input.zMm },
  };
}

function signedArea(points: HouseFootprintSideLocalPoint[]): number {
  return points.reduce((sum, current, idx) => {
    const next = points[(idx + 1) % points.length]!;
    return sum + current.alongM * next.depthM - next.alongM * current.depthM;
  }, 0) / 2;
}

function normalizeSideLocalOrder(points: HouseFootprintSideLocalPoint[]): HouseFootprintSideLocalPoint[] {
  const ordered = signedArea(points) > 0 ? [...points].reverse() : [...points];
  let firstIdx = 0;
  for (let idx = 1; idx < ordered.length; idx += 1) {
    const candidate = ordered[idx]!;
    const selected = ordered[firstIdx]!;
    if (candidate.alongM < selected.alongM - EPSILON) {
      firstIdx = idx;
    } else if (Math.abs(candidate.alongM - selected.alongM) <= EPSILON && candidate.depthM < selected.depthM - EPSILON) {
      firstIdx = idx;
    }
  }
  return [...ordered.slice(firstIdx), ...ordered.slice(0, firstIdx)];
}

function pointsEqual(a: HouseFootprintSideLocalPoint, b: HouseFootprintSideLocalPoint): boolean {
  return Math.abs(a.alongM - b.alongM) <= EPSILON && Math.abs(a.depthM - b.depthM) <= EPSILON;
}

function segmentsIntersect(
  a1: HouseFootprintSideLocalPoint,
  a2: HouseFootprintSideLocalPoint,
  b1: HouseFootprintSideLocalPoint,
  b2: HouseFootprintSideLocalPoint,
): boolean {
  const orientation = (
    p: HouseFootprintSideLocalPoint,
    q: HouseFootprintSideLocalPoint,
    r: HouseFootprintSideLocalPoint,
  ) => (q.depthM - p.depthM) * (r.alongM - q.alongM) - (q.alongM - p.alongM) * (r.depthM - q.depthM);
  const onSegment = (
    p: HouseFootprintSideLocalPoint,
    q: HouseFootprintSideLocalPoint,
    r: HouseFootprintSideLocalPoint,
  ) =>
    q.alongM <= Math.max(p.alongM, r.alongM) + EPSILON &&
    q.alongM + EPSILON >= Math.min(p.alongM, r.alongM) &&
    q.depthM <= Math.max(p.depthM, r.depthM) + EPSILON &&
    q.depthM + EPSILON >= Math.min(p.depthM, r.depthM);

  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (Math.abs(o1) <= EPSILON && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= EPSILON && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= EPSILON && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= EPSILON && onSegment(b1, a2, b2)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function parseCustomSideLocalPolygon(
  polygon: HouseFootprintPolygonPointInput[] | null | undefined,
): { ok: true; points: HouseFootprintSideLocalPoint[] } | { ok: false; error: string } {
  if (!polygon || polygon.length < 4) {
    return { ok: false, error: 'House footprint outline needs at least 4 points.' };
  }

  const points: HouseFootprintSideLocalPoint[] = [];
  for (const raw of polygon) {
    const alongM = parseFiniteNumber(raw.alongM);
    const depthM = parseFiniteNumber(raw.depthM);
    if (alongM === null || depthM === null) {
      return { ok: false, error: 'House footprint outline points need finite along/depth values.' };
    }
    points.push({ alongM, depthM });
  }

  if (points.length > 1 && pointsEqual(points[0]!, points[points.length - 1]!)) {
    points.pop();
  }
  if (points.length < 4) {
    return { ok: false, error: 'House footprint outline needs at least 4 unique points.' };
  }

  for (let idx = 0; idx < points.length; idx += 1) {
    const current = points[idx]!;
    const next = points[(idx + 1) % points.length]!;
    if (pointsEqual(current, next)) {
      return { ok: false, error: 'House footprint outline cannot include duplicate consecutive points.' };
    }
    if (Math.abs(current.alongM - next.alongM) > EPSILON && Math.abs(current.depthM - next.depthM) > EPSILON) {
      return { ok: false, error: 'House footprint outline must use 90-degree wall segments.' };
    }
  }

  if (Math.abs(signedArea(points)) <= EPSILON) {
    return { ok: false, error: 'House footprint outline needs a non-zero area.' };
  }

  for (let idx = 0; idx < points.length; idx += 1) {
    const a1 = points[idx]!;
    const a2 = points[(idx + 1) % points.length]!;
    for (let jdx = idx + 1; jdx < points.length; jdx += 1) {
      if (Math.abs(idx - jdx) <= 1 || (idx === 0 && jdx === points.length - 1)) continue;
      const b1 = points[jdx]!;
      const b2 = points[(jdx + 1) % points.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return { ok: false, error: 'House footprint outline cannot self-intersect.' };
      }
    }
  }

  return { ok: true, points: normalizeSideLocalOrder(points) };
}

export function buildCustomHouseFootprintPolygon(input: {
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  polygon?: HouseFootprintPolygonPointInput[] | null;
  params?: HouseFootprintParams | null;
  attachmentSide?: AttachmentSide | null;
}): HouseFootprintPolygonResult {
  const frame = resolveHouseFootprintFrame(input);
  const resolved = resolveParams({
    params: normalizeParams(input.params),
    pergolaWidthM: frame.alongWidthM,
    pergolaDepthM: frame.perpendicularDepthM,
  });
  const parsed = parseCustomSideLocalPolygon(input.polygon);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    sideLocalPoints: parsed.points,
    polygon: houseFootprintSideLocalToWorldPolygon({
      points: parsed.points,
      frame,
      resolved,
    }),
  };
}

function buildPresetLocalPoints(input: {
  preset: HouseFootprintPreset;
  resolved: ResolvedHouseFootprintParams;
  depthM: number;
}): Point2[] {
  const width = input.resolved.widthM;
  const depth = input.depthM;
  const bandDepth = input.resolved.bandDepthM;
  const returnRun = input.resolved.returnRunM;
  const recessWidth = input.resolved.recessWidthM;
  const recessDepth = input.resolved.recessDepthM;
  const leftLegRun = input.resolved.leftLegRunM;
  const rightLegRun = input.resolved.rightLegRunM;
  const sideRun = input.resolved.sideRunM;
  const totalRecessDepth = bandDepth + recessDepth;

  if (input.preset === 'recess_left') {
    return [
      point(0, -totalRecessDepth),
      point(width, -totalRecessDepth),
      point(width, 0),
      point(recessWidth, 0),
      point(recessWidth, -recessDepth),
      point(0, -recessDepth),
    ];
  }

  if (input.preset === 'recess_right') {
    return [
      point(0, -totalRecessDepth),
      point(width, -totalRecessDepth),
      point(width, -recessDepth),
      point(width - recessWidth, -recessDepth),
      point(width - recessWidth, 0),
      point(0, 0),
    ];
  }

  if (input.preset === 'l_left') {
    return [
      point(-bandDepth, -bandDepth),
      point(width, -bandDepth),
      point(width, 0),
      point(0, 0),
      point(0, returnRun),
      point(-bandDepth, returnRun),
    ];
  }

  if (input.preset === 'l_right') {
    return [
      point(0, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, returnRun),
      point(width, returnRun),
      point(width, 0),
      point(0, 0),
    ];
  }

  if (input.preset === 'u_shape') {
    return [
      point(-bandDepth, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, rightLegRun),
      point(width, rightLegRun),
      point(width, 0),
      point(0, 0),
      point(0, leftLegRun),
      point(-bandDepth, leftLegRun),
    ];
  }

  if (input.preset === 'wrap_left') {
    return [
      point(-bandDepth, -bandDepth),
      point(width, -bandDepth),
      point(width, 0),
      point(0, 0),
      point(0, depth),
      point(sideRun, depth),
      point(sideRun, depth + bandDepth),
      point(-bandDepth, depth + bandDepth),
    ];
  }

  if (input.preset === 'wrap_right') {
    return [
      point(0, -bandDepth),
      point(width + bandDepth, -bandDepth),
      point(width + bandDepth, depth + bandDepth),
      point(width - sideRun, depth + bandDepth),
      point(width - sideRun, depth),
      point(width, depth),
      point(width, 0),
      point(0, 0),
    ];
  }

  return [point(0, -bandDepth), point(width, -bandDepth), point(width, 0), point(0, 0)];
}

export function buildHouseFootprintPresetSideLocalPoints(input: {
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  preset?: HouseFootprintPreset | null;
  params?: HouseFootprintParams | null;
  attachmentSide?: AttachmentSide | null;
}): HouseFootprintSideLocalPoint[] {
  const frame = resolveHouseFootprintFrame(input);
  const resolved = resolveParams({
    params: normalizeParams(input.params),
    pergolaWidthM: frame.alongWidthM,
    pergolaDepthM: frame.perpendicularDepthM,
  });
  return buildPresetLocalPoints({
    preset: normalizePreset(input.preset),
    resolved,
    depthM: frame.perpendicularDepthM,
  }).map(presetPointToSideLocal);
}

export function buildHouseFootprintPolygon(input: {
  pergolaWidthMm: number;
  pergolaDepthMm: number;
  preset?: HouseFootprintPreset | null;
  params?: HouseFootprintParams | null;
  attachmentSide?: AttachmentSide | null;
}): Polygon3 {
  const frame = resolveHouseFootprintFrame(input);
  const preset = normalizePreset(input.preset);
  const params = normalizeParams(input.params);
  const resolved = resolveParams({
    params,
    pergolaWidthM: frame.alongWidthM,
    pergolaDepthM: frame.perpendicularDepthM,
  });
  return houseFootprintSideLocalToWorldPolygon({
    points: buildPresetLocalPoints({
      preset,
      resolved,
      depthM: frame.perpendicularDepthM,
    }).map(presetPointToSideLocal),
    resolved,
    frame,
  });
}
