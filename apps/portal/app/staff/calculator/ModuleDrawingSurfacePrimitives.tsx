import type { AttachmentSide } from '@sp/costing';
import styles from './CalculatorGrid.module.css';
import type { EstimateDrawingScale } from '@/lib/estimates/drawingSheet';
import {
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';
import type {
  ModuleDrawingInteractiveField,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
} from './ModuleDrawingContracts';
export type Point = { x: number; y: number };


export type PlanAttachmentFrame = {
  start: Point;
  end: Point;
  tangent: Point;
  outward: Point;
  length: number;
};


export function attachmentFrameForRect(
  side: AttachmentSide,
  rect: { x: number; y: number; width: number; height: number },
): PlanAttachmentFrame {
  if (side === 'front') {
    return {
      start: { x: rect.x, y: rect.y + rect.height },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 1, y: 0 },
      outward: { x: 0, y: 1 },
      length: rect.width,
    };
  }
  if (side === 'left') {
    return {
      start: { x: rect.x, y: rect.y },
      end: { x: rect.x, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: -1, y: 0 },
      length: rect.height,
    };
  }
  if (side === 'right') {
    return {
      start: { x: rect.x + rect.width, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: 1, y: 0 },
      length: rect.height,
    };
  }
  return {
    start: { x: rect.x, y: rect.y },
    end: { x: rect.x + rect.width, y: rect.y },
    tangent: { x: 1, y: 0 },
    outward: { x: 0, y: -1 },
    length: rect.width,
  };
}


export function pointOnAttachmentFrame(frame: PlanAttachmentFrame, along: number, outward: number): Point {
  return {
    x: frame.start.x + frame.tangent.x * along + frame.outward.x * outward,
    y: frame.start.y + frame.tangent.y * along + frame.outward.y * outward,
  };
}


type TickDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  textX?: number;
  textY?: number;
  rotateDeg?: number;
  overrun?: number;
  showTermBars?: boolean;
  presentation?: ModuleDrawingPresentation;
  interactiveField?: ModuleDrawingInteractiveField;
  lineClassName?: string;
  tickClassName?: string;
  textClassName?: string;
};


type DimensionPresentationSpec = {
  tickHalf: number;
  barHalf: number;
  barOffset: number;
  labelClearance: number;
  horizontalLabelGap: number;
  verticalLabelGap: number;
};


type TickDimensionGeometry = {
  lineStartX: number;
  lineStartY: number;
  lineEndX: number;
  lineEndY: number;
  tick1StartX: number;
  tick1StartY: number;
  tick1EndX: number;
  tick1EndY: number;
  tick2StartX: number;
  tick2StartY: number;
  tick2EndX: number;
  tick2EndY: number;
  labelX: number;
  labelY: number;
  labelRotate?: number;
  termBar1?: { x1: number; y1: number; x2: number; y2: number };
  termBar2?: { x1: number; y1: number; x2: number; y2: number };
};


export type SvgDebugScaleProps = {
  scaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
};


export function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}


export function formatMetresPrecise(value: number, decimals = 3): string {
  return `${value.toFixed(decimals)}m`;
}


export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}


export function getDimensionPresentationSpec(presentation: ModuleDrawingPresentation): DimensionPresentationSpec {
  if (presentation === 'sheet') {
    return {
      tickHalf: 0.74,
      barHalf: 0.52,
      barOffset: 0.42,
      labelClearance: 2.05,
      horizontalLabelGap: 2.15,
      verticalLabelGap: 3.05,
    };
  }

  return {
    tickHalf: 0.96,
    barHalf: 0.68,
    barOffset: 0.52,
    labelClearance: 1.82,
    horizontalLabelGap: 2.05,
    verticalLabelGap: 2.78,
  };
}


export function memberSizeM(value: number | null | undefined, fallbackM: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallbackM;
}


export const MODEL_SPACE_UNITS_PER_METRE = 12;

export const MODEL_SPACE_CSS_PX_PER_UNIT = 8;

export const MODEL_SPACE_VIEWBOX_PADDING = 6;


export type SheetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};


export type SheetDrawingField = SheetRect;

export type SheetFitArea = SheetRect;

export type AnnotatedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};


type BoundsInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};


type LayoutOffset = {
  dx: number;
  dy: number;
};


type DebugOutlineProps = {
  rect: SheetRect;
  className: string;
  marker: string;
};


export type ResolvedModelSpaceLayout = ResolvedSheetLayout & {
  viewBox: SheetRect;
  viewBoxValue: string;
  worldBounds: AnnotatedBounds;
  worldBox: SheetRect;
  worldBoxValue: string;
  focusBounds: AnnotatedBounds;
  focusBox: SheetRect;
  focusBoxValue: string;
  svgWidthPx: number;
  svgHeightPx: number;
};


export function getSheetDrawingField(): SheetDrawingField {
  // Keep the outer field flush to the top/left/right edges, but reserve the
  // lower title-block band so the sheet field stops at the top of the block.
  // The footer metadata has been compacted into the right rail, so the sheet
  // can reclaim a little more vertical drawing area than before.
  return {
    x: 0,
    y: 0,
    width: 120,
    height: 86.0,
  };
}


export function DebugOutline({ rect, className, marker }: DebugOutlineProps) {
  const inset = 0.16;
  const rawX1 = rect.x;
  const rawY1 = rect.y;
  const rawX2 = rect.x + rect.width;
  const rawY2 = rect.y + rect.height;
  const x1 = rawX1 <= 0 ? rawX1 + inset : rawX1;
  const y1 = rawY1 <= 0 ? rawY1 + inset : rawY1;
  const x2 = rawX2 >= 120 ? rawX2 - inset : rawX2;
  const y2 = rawY2 >= 90 ? rawY2 - inset : rawY2;

  return (
    <g data-debug-crop={marker} aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y1} className={className} />
      <line x1={x1} y1={y1} x2={x1} y2={y2} className={className} />
      <line x1={x2} y1={y1} x2={x2} y2={y2} className={className} />
      <line x1={x1} y1={y2} x2={x2} y2={y2} className={className} />
    </g>
  );
}


export function insetRect(rect: SheetRect, insets: BoundsInsets): SheetRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0.1, rect.width - insets.left - insets.right),
    height: Math.max(0.1, rect.height - insets.top - insets.bottom),
  };
}


export function createBounds(minX: number, minY: number, maxX: number, maxY: number): AnnotatedBounds {
  return { minX, minY, maxX, maxY };
}


export function boundsFromRect(x: number, y: number, width: number, height: number): AnnotatedBounds {
  return createBounds(
    Math.min(x, x + width),
    Math.min(y, y + height),
    Math.max(x, x + width),
    Math.max(y, y + height),
  );
}


export function boundsFromLine(x1: number, y1: number, x2: number, y2: number, pad = 0): AnnotatedBounds {
  return createBounds(Math.min(x1, x2) - pad, Math.min(y1, y2) - pad, Math.max(x1, x2) + pad, Math.max(y1, y2) + pad);
}


export function boundsFromPoints(points: Point[], pad = 0): AnnotatedBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return createBounds(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
}


export function unionBounds(bounds: Array<AnnotatedBounds | null | undefined>): AnnotatedBounds {
  const valid = bounds.filter((entry): entry is AnnotatedBounds => Boolean(entry));
  if (valid.length === 0) return createBounds(0, 0, 0, 0);

  return createBounds(
    Math.min(...valid.map((entry) => entry.minX)),
    Math.min(...valid.map((entry) => entry.minY)),
    Math.max(...valid.map((entry) => entry.maxX)),
    Math.max(...valid.map((entry) => entry.maxY)),
  );
}


export function translateBounds(bounds: AnnotatedBounds, dx: number, dy: number): AnnotatedBounds {
  return createBounds(bounds.minX + dx, bounds.minY + dy, bounds.maxX + dx, bounds.maxY + dy);
}


export function getBoundsWidth(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxX - bounds.minX);
}


export function getBoundsHeight(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxY - bounds.minY);
}


export function boundsToPaddedRect(bounds: AnnotatedBounds, padding: number): SheetRect {
  const width = Math.max(1, getBoundsWidth(bounds) + padding * 2);
  const height = Math.max(1, getBoundsHeight(bounds) + padding * 2);
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width,
    height,
  };
}


function formatViewBoxNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/\.?0+$/, '');
}


function rectToViewBox(rect: SheetRect): string {
  return [rect.x, rect.y, rect.width, rect.height].map(formatViewBoxNumber).join(' ');
}


export function resolveModelSpaceSvgMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'viewBox' | 'viewBoxValue' | 'svgWidthPx' | 'svgHeightPx'> {
  const viewBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    viewBox,
    viewBoxValue: rectToViewBox(viewBox),
    svgWidthPx: Math.round(viewBox.width * MODEL_SPACE_CSS_PX_PER_UNIT),
    svgHeightPx: Math.round(viewBox.height * MODEL_SPACE_CSS_PX_PER_UNIT),
  };
}


export function resolveModelSpaceFocusMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'focusBounds' | 'focusBox' | 'focusBoxValue'> {
  const focusBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    focusBounds: bounds,
    focusBox,
    focusBoxValue: rectToViewBox(focusBox),
  };
}


export function resolveModelSpaceWorldMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'worldBounds' | 'worldBox' | 'worldBoxValue'> {
  const worldBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    worldBounds: bounds,
    worldBox,
    worldBoxValue: rectToViewBox(worldBox),
  };
}


export function FocusTarget({ rect }: { rect: SheetRect }) {
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill="transparent"
      opacity={0}
      pointerEvents="none"
      aria-hidden="true"
      data-model-space-focus-target="true"
    />
  );
}


export function resolveBoundsPlacement(bounds: AnnotatedBounds, fitArea: SheetFitArea, verticalBias: number): LayoutOffset {
  const slackX = Math.max(0, fitArea.width - getBoundsWidth(bounds));
  const slackY = Math.max(0, fitArea.height - getBoundsHeight(bounds));
  return {
    dx: fitArea.x - bounds.minX + slackX / 2,
    dy: fitArea.y - bounds.minY + slackY * verticalBias,
  };
}


export function fitsWithinArea(bounds: AnnotatedBounds, fitArea: SheetFitArea): boolean {
  return getBoundsWidth(bounds) <= fitArea.width + 1e-6 && getBoundsHeight(bounds) <= fitArea.height + 1e-6;
}


export function estimateTextBounds(input: {
  text: string;
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  fontHeight: number;
  charWidth: number;
  paddingX?: number;
  paddingY?: number;
  rotateDeg?: number;
}): AnnotatedBounds {
  const width = Math.max(input.fontHeight * 0.9, input.text.length * input.charWidth + (input.paddingX ?? 0) * 2);
  const height = input.fontHeight + (input.paddingY ?? 0) * 2;
  const anchor = input.anchor ?? 'middle';
  const baseX = anchor === 'middle' ? input.x - width / 2 : anchor === 'end' ? input.x - width : input.x;
  const baseY = input.y - height / 2;
  const rect = boundsFromRect(baseX, baseY, width, height);

  if ((input.rotateDeg ?? 0) % 180 === 0) return rect;

  const corners: Point[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  const rad = ((input.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return boundsFromPoints(
    corners.map((corner) => ({
      x: input.x + (corner.x - input.x) * cos - (corner.y - input.y) * sin,
      y: input.y + (corner.x - input.x) * sin + (corner.y - input.y) * cos,
    })),
  );
}


export function evaluateAnnotatedSheetFit(input: {
  bounds: AnnotatedBounds;
  fitArea: SheetFitArea;
  viewportMm?: { widthMm: number; heightMm: number };
}): DrawingSheetFitResult {
  return {
    fits: fitsWithinArea(input.bounds, input.fitArea),
    requiredWidthMm: viewBoxUnitsToMm(getBoundsWidth(input.bounds), input.viewportMm),
    requiredHeightMm: viewBoxUnitsToMm(getBoundsHeight(input.bounds), input.viewportMm),
    availableWidthMm: viewBoxUnitsToMm(input.fitArea.width, input.viewportMm),
    availableHeightMm: viewBoxUnitsToMm(input.fitArea.height, input.viewportMm),
  };
}


export function viewBoxUnitsToMm(value: number, viewportMm?: { widthMm: number; heightMm: number }): number {
  return value / getViewBoxUnitsPerMm(viewportMm);
}


export function toPointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}


export function segmentDownNormal(x1: number, y1: number, x2: number, y2: number): { nx: number; ny: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx *= -1;
    ny *= -1;
  }
  return { nx, ny, len };
}


export function rotatePointQuarterTurns(point: Point, center: Point, turns: number): Point {
  const normalized = ((turns % 4) + 4) % 4;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (normalized === 1) return { x: center.x + dy, y: center.y - dx };
  if (normalized === 2) return { x: center.x - dx, y: center.y - dy };
  if (normalized === 3) return { x: center.x - dy, y: center.y + dx };
  return point;
}


export function rotatePointsQuarterTurns(points: Point[], center: Point, turns: number): Point[] {
  return points.map((point) => rotatePointQuarterTurns(point, center, turns));
}


export function rotateBoundsQuarterTurns(bounds: AnnotatedBounds, center: Point, turns: number): AnnotatedBounds {
  return boundsFromPoints(
    rotatePointsQuarterTurns(
      [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ],
      center,
      turns,
    ),
  );
}


export function rectToPoints(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}


function resolveTickDimensionGeometry({
  x1,
  y1,
  x2,
  y2,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
}: Omit<TickDimensionProps, 'label'>): TickDimensionGeometry {
  const dimSpec = getDimensionPresentationSpec(presentation);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = dimSpec.tickHalf;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const lineStartX = x1 - ux * overrun;
  const lineStartY = y1 - uy * overrun;
  const lineEndX = x2 + ux * overrun;
  const lineEndY = y2 + uy * overrun;
  const barHalf = dimSpec.barHalf;
  const barOffset = dimSpec.barOffset;
  const horizontalBias = Math.abs(dx) >= Math.abs(dy) * 1.35;
  const verticalBias = Math.abs(dy) > Math.abs(dx) * 1.35;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const labelX = textX ?? (verticalBias ? cx - dimSpec.verticalLabelGap : horizontalBias ? cx : cx - nx * dimSpec.labelClearance);
  const labelY = textY ?? (verticalBias ? cy : horizontalBias ? cy - dimSpec.horizontalLabelGap : cy - ny * dimSpec.labelClearance);
  const labelRotate = rotateDeg ?? (verticalBias ? -90 : undefined);

  return {
    lineStartX,
    lineStartY,
    lineEndX,
    lineEndY,
    tick1StartX: x1 - tx,
    tick1StartY: y1 - ty,
    tick1EndX: x1 + tx,
    tick1EndY: y1 + ty,
    tick2StartX: x2 - tx,
    tick2StartY: y2 - ty,
    tick2EndX: x2 + tx,
    tick2EndY: y2 + ty,
    labelX,
    labelY,
    labelRotate,
    termBar1: showTermBars
      ? {
          x1: x1 + ux * barOffset - nx * barHalf,
          y1: y1 + uy * barOffset - ny * barHalf,
          x2: x1 + ux * barOffset + nx * barHalf,
          y2: y1 + uy * barOffset + ny * barHalf,
        }
      : undefined,
    termBar2: showTermBars
      ? {
          x1: x2 - ux * barOffset - nx * barHalf,
          y1: y2 - uy * barOffset - ny * barHalf,
          x2: x2 - ux * barOffset + nx * barHalf,
          y2: y2 - uy * barOffset + ny * barHalf,
        }
      : undefined,
  };
}


export function TickDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
  interactiveField,
  lineClassName,
  tickClassName,
  textClassName,
}: TickDimensionProps) {
  const geometry = resolveTickDimensionGeometry({
    x1,
    y1,
    x2,
    y2,
    textX,
    textY,
    rotateDeg,
    overrun,
    showTermBars,
    presentation,
  });

  return (
    <g>
      <line
        x1={geometry.lineStartX}
        y1={geometry.lineStartY}
        x2={geometry.lineEndX}
        y2={geometry.lineEndY}
        className={[styles.moduleDimLine, lineClassName].filter(Boolean).join(' ')}
      />
      {geometry.termBar1 && geometry.termBar2 ? (
        <>
          <line
            x1={geometry.termBar1.x1}
            y1={geometry.termBar1.y1}
            x2={geometry.termBar1.x2}
            y2={geometry.termBar1.y2}
            className={styles.moduleDimTermBar}
          />
          <line
            x1={geometry.termBar2.x1}
            y1={geometry.termBar2.y1}
            x2={geometry.termBar2.x2}
            y2={geometry.termBar2.y2}
            className={styles.moduleDimTermBar}
          />
        </>
      ) : null}
      <line
        x1={geometry.tick1StartX}
        y1={geometry.tick1StartY}
        x2={geometry.tick1EndX}
        y2={geometry.tick1EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <line
        x1={geometry.tick2StartX}
        y1={geometry.tick2StartY}
        x2={geometry.tick2EndX}
        y2={geometry.tick2EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        className={[
          styles.moduleDimText,
          interactiveField ? styles.moduleDimTextEditable : '',
          textClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        transform={typeof geometry.labelRotate === 'number' ? `rotate(${geometry.labelRotate} ${geometry.labelX} ${geometry.labelY})` : undefined}
        data-editable-field-id={interactiveField?.fieldId}
        tabIndex={interactiveField?.onActivate ? 0 : undefined}
        onClick={interactiveField?.onActivate ? (event) => interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          interactiveField?.onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {label}
      </text>
    </g>
  );
}


export function estimateTickDimensionBounds(
  props: TickDimensionProps,
  options?: {
    charWidth?: number;
    fontHeight?: number;
    paddingX?: number;
    paddingY?: number;
  },
): AnnotatedBounds {
  const geometry = resolveTickDimensionGeometry(props);
  return unionBounds([
    boundsFromLine(geometry.lineStartX, geometry.lineStartY, geometry.lineEndX, geometry.lineEndY, 0.45),
    boundsFromLine(geometry.tick1StartX, geometry.tick1StartY, geometry.tick1EndX, geometry.tick1EndY, 0.35),
    boundsFromLine(geometry.tick2StartX, geometry.tick2StartY, geometry.tick2EndX, geometry.tick2EndY, 0.35),
    geometry.termBar1 ? boundsFromLine(geometry.termBar1.x1, geometry.termBar1.y1, geometry.termBar1.x2, geometry.termBar1.y2, 0.25) : null,
    geometry.termBar2 ? boundsFromLine(geometry.termBar2.x1, geometry.termBar2.y1, geometry.termBar2.x2, geometry.termBar2.y2, 0.25) : null,
    estimateTextBounds({
      text: props.label,
      x: geometry.labelX,
      y: geometry.labelY,
      anchor: 'middle',
      fontHeight: options?.fontHeight ?? (props.presentation === 'sheet' ? 1.85 : 2.3),
      charWidth: options?.charWidth ?? (props.presentation === 'sheet' ? 0.62 : 0.78),
      paddingX: options?.paddingX ?? 0.35,
      paddingY: options?.paddingY ?? 0.18,
      rotateDeg: geometry.labelRotate,
    }),
  ]);
}


export function ArrowHead({
  x,
  y,
  direction,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}) {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  if (direction === 'up') {
    return (
      <g>
        <line x1={x} y1={y - reach} x2={x - span} y2={y + reach} className={styles.moduleFallHead} />
        <line x1={x} y1={y - reach} x2={x + span} y2={y + reach} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'left') {
    return (
      <g>
        <line x1={x - reach} y1={y} x2={x + reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x - reach} y1={y} x2={x + reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'right') {
    return (
      <g>
        <line x1={x + reach} y1={y} x2={x - reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x + reach} y1={y} x2={x - reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  return (
    <g>
      <line x1={x} y1={y + reach} x2={x - span} y2={y - reach} className={styles.moduleFallHead} />
      <line x1={x} y1={y + reach} x2={x + span} y2={y - reach} className={styles.moduleFallHead} />
    </g>
  );
}


export function estimateArrowHeadBounds({
  x,
  y,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  return boundsFromRect(x - span - 0.25, y - reach - 0.25, span * 2 + 0.5, reach * 2 + 0.5);
}


function formatScaleDebugLabel(scale: EstimateDrawingScale): string {
  return scale.mode === 'fit' ? 'NTS' : `1:${scale.ratio}`;
}


export function buildSheetDebugMetrics(
  layout: ResolvedSheetLayout,
  scaleState?: ModuleDrawingScaleState | null,
  diagnostics: ModuleDrawingScaleDiagnostic[] = [],
): SheetDebugMetrics {
  const boundsWidth = getBoundsWidth(layout.annotatedBounds);
  const boundsHeight = getBoundsHeight(layout.annotatedBounds);
  return {
    requestedScaleLabel: formatScaleDebugLabel(scaleState?.requestedScale ?? { mode: 'fit' }),
    appliedScaleLabel: formatScaleDebugLabel(scaleState?.appliedScale ?? { mode: 'fit' }),
    boundsWidth,
    boundsHeight,
    fitWidth: layout.fitArea.width,
    fitHeight: layout.fitArea.height,
    utilizationX: boundsWidth / Math.max(layout.fitArea.width, 0.001),
    utilizationY: boundsHeight / Math.max(layout.fitArea.height, 0.001),
    candidateLines: diagnostics.map((diagnostic) => {
      const scaleLabel = formatScaleDebugLabel(diagnostic.scale);
      return `${scaleLabel} ${diagnostic.fits ? 'ok' : 'no'} ${Math.round(diagnostic.utilizationX * 100)}%/${Math.round(diagnostic.utilizationY * 100)}%`;
    }),
  };
}


export function resolveMeasuredFitLayout(input: {
  initialScale: number;
  resolveForScale: (scale: number) => ResolvedSheetLayout;
}): ResolvedSheetLayout {
  let scale = Math.max(0.05, input.initialScale);
  let layout = input.resolveForScale(scale);

  for (let idx = 0; idx < 8; idx += 1) {
    const ratio = Math.min(
      layout.fitArea.width / Math.max(getBoundsWidth(layout.annotatedBounds), 0.001),
      layout.fitArea.height / Math.max(getBoundsHeight(layout.annotatedBounds), 0.001),
    );
    const nextScale = Math.max(0.05, scale * ratio);
    if (Math.abs(nextScale - scale) <= 0.0005) {
      scale = nextScale;
      layout = input.resolveForScale(scale);
      break;
    }
    scale = nextScale;
    layout = input.resolveForScale(scale);
  }

  for (let idx = 0; idx < 12 && !fitsWithinArea(layout.annotatedBounds, layout.fitArea); idx += 1) {
    scale *= 0.995;
    layout = input.resolveForScale(scale);
  }

  return layout;
}


export type ResolvedSheetLayout = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  annotatedBounds: AnnotatedBounds;
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};


export type SheetDebugMetrics = {
  requestedScaleLabel: string;
  appliedScaleLabel: string;
  boundsWidth: number;
  boundsHeight: number;
  fitWidth: number;
  fitHeight: number;
  utilizationX: number;
  utilizationY: number;
  candidateLines: string[];
};


