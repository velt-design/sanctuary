import type { GeometryTopProjectionShape } from '@sp/geometry';

/**
 * PR-WB-CANVAS (2026-06-22): canvas-side equivalent of `shapeStyle.ts` +
 * `planLineweights.module.css`. The SVG path styles shapes via CSS token
 * classes; canvas can't use CSS classes, so this returns concrete fill /
 * stroke / width values that MIRROR those tokens. Keep in sync with
 * `planLineweights.module.css` (the `.tokens` block).
 *
 * `widthPx` is a SCREEN width (the SVG uses `vector-effect: non-scaling-
 * stroke`, i.e. a constant device-px width at every zoom). The renderer
 * divides it by the camera scale so strokes stay constant on screen.
 */
export type CanvasShapeStyle = {
  fill: string | null;
  stroke: string | null;
  widthPx: number;
  dash?: number[];
};

const STROKE = {
  cut: { stroke: '#1a1a1a', widthPx: 2 },
  visible: { stroke: '#333333', widthPx: 1 },
  light: { stroke: '#888888', widthPx: 0.5 },
  hairline: { stroke: '#b8b8b8', widthPx: 0.25 },
} as const;

const FILL = {
  pergolaRoof: 'rgba(20, 20, 20, 0.92)',
  pergolaRafter: 'rgba(180, 180, 180, 0.55)',
  pergolaCladding: 'rgba(220, 220, 220, 0.45)',
  pergolaRidge: 'rgba(60, 60, 60, 0.85)',
  houseDeck: 'rgba(180, 200, 220, 0.55)',
  houseRoof: 'rgba(150, 130, 100, 0.45)',
  houseSoffit: 'rgba(220, 220, 220, 0.50)',
  houseFascia: 'rgba(140, 100, 80, 0.55)',
  houseAttachmentZone: 'rgba(255, 200, 100, 0.30)',
  houseFootprint: 'rgba(245, 245, 245, 0.85)',
  houseOpening: 'rgba(80, 140, 200, 0.40)',
} as const;

function isTransparentRoof(shape: GeometryTopProjectionShape): boolean {
  if (shape.metadata?.planProjectionSource === 'house_terminal_end') return true;
  if (shape.kind === 'roof' && shape.metadata?.isOpen === true) return true;
  return false;
}

function houseBodyStyle(shape: GeometryTopProjectionShape): CanvasShapeStyle {
  switch (shape.kind) {
    case 'deck':
      return { ...STROKE.visible, fill: FILL.houseDeck };
    case 'opening_marker':
    case 'opening_outline':
      return { ...STROKE.visible, fill: FILL.houseOpening };
    case 'roof':
    case 'house_roof_material':
      return isTransparentRoof(shape)
        ? { fill: null, stroke: null, widthPx: 0 }
        : { ...STROKE.visible, fill: FILL.houseRoof };
    case 'soffit':
      return { ...STROKE.light, fill: FILL.houseSoffit };
    case 'fascia':
      return { ...STROKE.visible, fill: FILL.houseFascia };
    case 'attachment_zone':
      return { ...STROKE.light, fill: FILL.houseAttachmentZone };
    case 'footprint':
      return shape.sourceType === 'house_reference'
        ? { ...STROKE.light, fill: null, dash: [6, 4] }
        : { ...STROKE.cut, fill: FILL.houseFootprint };
    case 'gutter':
    case 'roof_feature':
    case 'wall_segment':
      return { ...STROKE.visible, fill: null };
    default:
      return { ...STROKE.hairline, fill: null };
  }
}

function pergolaBodyStyle(shape: GeometryTopProjectionShape): CanvasShapeStyle {
  switch (shape.kind) {
    case 'roof_cladding':
      return { ...STROKE.light, fill: FILL.pergolaCladding };
    case 'rafter':
      return { ...STROKE.light, fill: FILL.pergolaRafter };
    case 'ridge':
      return { ...STROKE.visible, fill: FILL.pergolaRidge };
    default:
      return { ...STROKE.visible, fill: FILL.pergolaRoof };
  }
}

export function canvasCommittedBodyStyle(
  shape: GeometryTopProjectionShape,
): CanvasShapeStyle {
  if (shape.family === 'house') return houseBodyStyle(shape);
  if (shape.family === 'reference') return { ...STROKE.hairline, fill: null };
  return pergolaBodyStyle(shape);
}

export const CANVAS_CONTEXT_LINE_STYLE: CanvasShapeStyle = { ...STROKE.light, fill: null };
export const CANVAS_DETAIL_LINE_STYLE: CanvasShapeStyle = { ...STROKE.visible, fill: null };
export const CANVAS_DIAGNOSTIC_FALLBACK_HOUSE: CanvasShapeStyle = {
  stroke: '#7b8288', widthPx: 1, fill: null, dash: [7, 4],
};
export const CANVAS_DIAGNOSTIC_FALLBACK_PERGOLA: CanvasShapeStyle = {
  stroke: '#9b6a24', widthPx: 1.5, fill: null, dash: [8, 4],
};
export const CANVAS_SELECTION_HALO: CanvasShapeStyle = {
  stroke: '#2f6f96', widthPx: 2, fill: null,
};
export const CANVAS_HOVER_HALO: CanvasShapeStyle = {
  stroke: '#2f6f96', widthPx: 1.5, fill: 'rgba(47, 111, 150, 0.08)',
};
