import type { InfillEdge, InfillLineItem } from '@/lib/types/calculator';
import { resolveMonoSlopeShape } from './infillCompute';

export type InfillOpeningTemplate = 'rectangle' | 'sloping_top' | 'triangle';
export type InfillTriangleHighSide = 'left' | 'right';

const ZERO_HEIGHT_TOLERANCE_M = 1e-6;

type MonoSlopeShape = Extract<InfillLineItem['shape'], { type: 'mono_slope' }>;

function formatShapeNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function maximumHeight(shape: InfillLineItem['shape']): number | null {
  if (shape.type === 'rect') {
    const parsed = Number.parseFloat(shape.heightM);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  const resolved = resolveMonoSlopeShape(shape);
  if (!resolved.leftInputValid && !resolved.rightInputValid) return null;
  return Math.max(resolved.leftHeightM, resolved.rightHeightM);
}

function commonShapeValues(shape: InfillLineItem['shape']) {
  return {
    widthM: shape.widthM,
    bottomOffsetM: shape.bottomOffsetM ?? '0',
  };
}

export function getTrianglePointSide(shape: InfillLineItem['shape']): Extract<InfillEdge, 'left' | 'right'> | null {
  if (shape.type !== 'mono_slope') return null;
  const resolved = resolveMonoSlopeShape(shape);
  const leftIsPoint = resolved.leftInputValid && resolved.leftHeightM <= ZERO_HEIGHT_TOLERANCE_M;
  const rightIsPoint = resolved.rightInputValid && resolved.rightHeightM <= ZERO_HEIGHT_TOLERANCE_M;
  if (leftIsPoint === rightIsPoint) return null;
  return leftIsPoint ? 'left' : 'right';
}

export function inferInfillOpeningTemplate(shape: InfillLineItem['shape']): InfillOpeningTemplate {
  if (shape.type === 'rect') return 'rectangle';
  return getTrianglePointSide(shape) ? 'triangle' : 'sloping_top';
}

export function getTriangleHighSide(shape: InfillLineItem['shape']): InfillTriangleHighSide {
  return getTrianglePointSide(shape) === 'right' ? 'left' : 'right';
}

export function setTriangleHighSide(
  shape: InfillLineItem['shape'],
  highSide: InfillTriangleHighSide,
): MonoSlopeShape {
  const common = commonShapeValues(shape);
  const maximum = maximumHeight(shape);
  const peakHeight = maximum !== null && maximum > ZERO_HEIGHT_TOLERANCE_M ? formatShapeNumber(maximum) : '';
  return {
    type: 'mono_slope',
    ...common,
    heightLowM: highSide === 'left' ? peakHeight : '0',
    heightHighM: highSide === 'right' ? peakHeight : '0',
    slopeMode: 'heights',
    slopeDeg: '',
    slopeAnchor: highSide === 'left' ? 'right' : 'left',
  };
}

export function syncInfillMonoSlopeDraft(shape: MonoSlopeShape): MonoSlopeShape {
  const resolved = resolveMonoSlopeShape(shape);
  const trianglePointSide = getTrianglePointSide(shape);
  const preserveEmptyTrianglePeak = resolved.slopeMode === 'heights' && trianglePointSide !== null;
  return {
    ...shape,
    heightLowM: trianglePointSide === 'left'
      ? '0'
      : preserveEmptyTrianglePeak && shape.heightLowM.trim() === ''
        ? ''
        : formatShapeNumber(resolved.leftHeightM),
    heightHighM: trianglePointSide === 'right'
      ? '0'
      : preserveEmptyTrianglePeak && shape.heightHighM.trim() === ''
        ? ''
        : formatShapeNumber(resolved.rightHeightM),
    slopeMode: resolved.slopeMode,
    slopeDeg: shape.slopeDeg ?? '',
    slopeAnchor: resolved.slopeAnchor,
  };
}

export function applyInfillOpeningTemplate(
  shape: InfillLineItem['shape'],
  template: InfillOpeningTemplate,
): InfillLineItem['shape'] {
  if (template === inferInfillOpeningTemplate(shape)) return shape;
  const common = commonShapeValues(shape);
  const peakHeight = formatShapeNumber(maximumHeight(shape) ?? 0);

  if (template === 'rectangle') {
    return { type: 'rect', ...common, heightM: peakHeight };
  }

  if (template === 'triangle') {
    const resolved = shape.type === 'mono_slope' ? resolveMonoSlopeShape(shape) : null;
    const highSide = resolved && resolved.leftHeightM > resolved.rightHeightM ? 'left' : 'right';
    return setTriangleHighSide(shape, highSide);
  }

  return {
    type: 'mono_slope',
    ...common,
    heightLowM: peakHeight,
    heightHighM: peakHeight,
    slopeMode: 'heights',
    slopeDeg: '',
    slopeAnchor: 'left',
  };
}
