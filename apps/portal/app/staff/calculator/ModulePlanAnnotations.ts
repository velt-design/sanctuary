import type { AttachmentSide } from '@sp/costing';
import type { GeometryTopProjectionViewModel, Vector2 } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
  type HouseFootprintHandleId,
  type HouseFootprintPoint,
  type ModulePlanModel,
  type ModuleSectionModel,
} from './moduleViews';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  getEstimateDrawingScaleOptions,
  type EstimateDrawingFixedScaleValue,
  type EstimateDrawingScale,
} from '@/lib/estimates/drawingSheet';
import {
  getDrawingSheetViewportMm,
  getViewBoxUnitsPerMetreAtScale,
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';
import type {
  GeometryConsistency,
  ModuleDrawingDisplayMode,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
  ModuleFootprintCanvasPoint,
  ModuleFootprintEditorProps,
  ModuleViewsTab,
} from './ModuleDrawingContracts';
import {
  ArrowHead,
  DebugOutline,
  FocusTarget,
  MODEL_SPACE_CSS_PX_PER_UNIT,
  MODEL_SPACE_UNITS_PER_METRE,
  MODEL_SPACE_VIEWBOX_PADDING,
  TickDimension,
  attachmentFrameForRect,
  boundsFromLine,
  boundsFromPoints,
  boundsFromRect,
  boundsToPaddedRect,
  buildSheetDebugMetrics,
  clamp,
  createBounds,
  estimateArrowHeadBounds,
  estimateTextBounds,
  estimateTickDimensionBounds,
  evaluateAnnotatedSheetFit,
  fitsWithinArea,
  formatMetres,
  formatMetresPrecise,
  getBoundsHeight,
  getBoundsWidth,
  getDimensionPresentationSpec,
  getSheetDrawingField,
  insetRect,
  memberSizeM,
  pointOnAttachmentFrame,
  rectToPoints,
  resolveBoundsPlacement,
  resolveMeasuredFitLayout,
  rotateBoundsQuarterTurns,
  rotatePointQuarterTurns,
  rotatePointsQuarterTurns,
  segmentDownNormal,
  toPointsAttr,
  translateBounds,
  unionBounds,
  viewBoxUnitsToMm,
  type AnnotatedBounds,
  type Point,
  type ResolvedModelSpaceLayout,
  type ResolvedSheetLayout,
  type SheetDebugMetrics,
  type SheetDrawingField,
  type SheetFitArea,
  type SheetRect,
  type SvgDebugScaleProps,
} from './ModuleDrawingSurfacePrimitives';
export { ArrowHead } from './ModuleDrawingSurfacePrimitives';
export function geometryFallDirectionToCardinal(direction: Vector2): CardinalDirection {
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return direction.x >= 0 ? 'right' : 'left';
  }
  return direction.y >= 0 ? 'down' : 'up';
}


export function rotateVectorQuarterTurns(vector: Point, turns: number): Point {
  return rotatePointQuarterTurns(vector, { x: 0, y: 0 }, turns);
}


type CardinalDirection = 'up' | 'down' | 'left' | 'right';


type PlanFallAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  label: string;
  labelPoint: Point;
  arrowHeads: Array<{ point: Point; direction: CardinalDirection }>;
};


type PlanSpacingAnnotationSpec = {
  witness1Start: Point;
  witness1End: Point;
  witness2Start: Point;
  witness2End: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};


type PlanLineTextAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  text: string;
  textPoint: Point;
  anchor?: 'start' | 'middle' | 'end';
};


function cardinalDirectionToVector(direction: CardinalDirection): Point {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
    default:
      return { x: 1, y: 0 };
  }
}


function vectorToCardinalDirection(vector: Point): CardinalDirection {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? 'right' : 'left';
  }
  return vector.y >= 0 ? 'down' : 'up';
}


function rotateCardinalDirectionQuarterTurns(direction: CardinalDirection, turns: number): CardinalDirection {
  return vectorToCardinalDirection(rotateVectorQuarterTurns(cardinalDirectionToVector(direction), turns));
}


export function buildPlanFallAnnotationSpec(input: {
  model: ModulePlanModel;
  attachmentSide: AttachmentSide;
  isHipCorner: boolean;
  isGableLike: boolean;
  baseX: number;
  baseY: number;
  aW: number;
  aH: number;
  bW: number;
  bH: number;
  bottomY: number;
  fallGap: number;
  rotationCenter: Point;
  rotationTurns: number;
  isSheet: boolean;
}): PlanFallAnnotationSpec {
  const { attachmentSide } = input;
  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: input.baseX + Math.max(input.aW, input.bW) + input.fallGap - 0.55,
          y: input.baseY,
          width: 0,
          height: input.isHipCorner ? input.aH + input.bH : input.aH,
        })
      : attachmentFrameForRect('front', {
          x: input.baseX,
          y: input.bottomY + input.fallGap - 0.55,
          width: input.aW,
          height: 0,
        });
  const fallStart = pointOnAttachmentFrame(fallAnchor, input.isSheet ? 1.5 : 1, 0);
  const fallEnd = pointOnAttachmentFrame(
    fallAnchor,
    Math.max(input.isSheet ? 1.5 : 1, fallAnchor.length - (input.isSheet ? 1.5 : 1)),
    0,
  );
  const fallLabelPoint = pointOnAttachmentFrame(
    fallAnchor,
    fallAnchor.length / 2,
    fallIsHorizontal ? (input.isSheet ? 0.8 : 2.2) : input.isSheet ? 0.62 : 2.3,
  );
  const localArrowHeads: Array<{ point: Point; direction: CardinalDirection }> = input.isGableLike
    ? [
        {
          point: fallStart,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
        },
        {
          point: fallEnd,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
        },
      ]
    : [
        {
          point: input.model.slopeDirection === 'toward_house' ? fallStart : fallEnd,
          direction: fallIsHorizontal
            ? attachmentSide === 'left'
              ? 'left'
              : 'right'
            : input.model.slopeDirection === 'toward_house'
              ? 'up'
              : 'down',
        },
      ];

  return {
    lineStart: rotatePointQuarterTurns(fallStart, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(fallEnd, input.rotationCenter, input.rotationTurns),
    label: input.isGableLike ? 'fall both sides' : 'fall',
    labelPoint: rotatePointQuarterTurns(fallLabelPoint, input.rotationCenter, input.rotationTurns),
    arrowHeads: localArrowHeads.map((arrowHead) => ({
      point: rotatePointQuarterTurns(arrowHead.point, input.rotationCenter, input.rotationTurns),
      direction: rotateCardinalDirectionQuarterTurns(arrowHead.direction, input.rotationTurns),
    })),
  };
}


export function estimatePlanFallAnnotationBounds(spec: PlanFallAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.25),
    ...spec.arrowHeads.map((arrowHead) =>
      estimateArrowHeadBounds({
        x: arrowHead.point.x,
        y: arrowHead.point.y,
        direction: arrowHead.direction,
        presentation,
      }),
    ),
    estimateTextBounds({
      text: spec.label,
      x: spec.labelPoint.x,
      y: spec.labelPoint.y,
      anchor: 'middle',
      fontHeight: presentation === 'sheet' ? 1.8 : 2.1,
      charWidth: presentation === 'sheet' ? 0.58 : 0.64,
      paddingX: 0.2,
      paddingY: 0.18,
    }),
  ]);
}


export function buildPlanRafterSpacingAnnotationSpec(input: {
  rafterXsA: number[];
  interiorRafterXsA: number[];
  splitY: number;
  gutterW: number;
  yBottomInner: number;
  rafterDimY: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
  label: string;
}): PlanSpacingAnnotationSpec | null {
  if (input.rafterXsA.length < 2) return null;

  const spacingXs = input.interiorRafterXsA.length >= 2 ? input.interiorRafterXsA : input.rafterXsA;
  const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
  const d1 = spacingXs[baseIdx]!;
  const d2 = spacingXs[baseIdx + 1]!;
  const witnessStartY = input.isHipCorner ? input.splitY - input.gutterW : input.yBottomInner;
  const witness1Start = rotatePointQuarterTurns({ x: d1, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness1End = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const witness2Start = rotatePointQuarterTurns({ x: d2, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness2End = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionStart = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionEnd = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);

  return {
    witness1Start,
    witness1End,
    witness2Start,
    witness2End,
    x1: dimensionStart.x,
    y1: dimensionStart.y,
    x2: dimensionEnd.x,
    y2: dimensionEnd.y,
    label: input.label,
  };
}


export function estimatePlanSpacingAnnotationBounds(spec: PlanSpacingAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.witness1Start.x, spec.witness1Start.y, spec.witness1End.x, spec.witness1End.y, 0.2),
    boundsFromLine(spec.witness2Start.x, spec.witness2Start.y, spec.witness2End.x, spec.witness2End.y, 0.2),
    estimateTickDimensionBounds({
      x1: spec.x1,
      y1: spec.y1,
      x2: spec.x2,
      y2: spec.y2,
      label: spec.label,
      presentation,
    }),
  ]);
}


export function buildPlanInternalAngleAnnotationSpec(input: {
  centerX: number;
  centerY: number;
  baseY: number;
  bottomY: number;
  aH: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
}): PlanLineTextAnnotationSpec {
  return {
    lineStart: rotatePointQuarterTurns({ x: input.centerX, y: input.baseY + 2.8 }, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(
      { x: input.centerX, y: (input.isHipCorner ? input.bottomY : input.baseY + input.aH) - 2.8 },
      input.rotationCenter,
      input.rotationTurns,
    ),
    text: 'internal roof angle',
    textPoint: rotatePointQuarterTurns({ x: input.centerX + 2.5, y: input.centerY + 0.5 }, input.rotationCenter, input.rotationTurns),
    anchor: 'start',
  };
}


export function estimatePlanLineTextAnnotationBounds(spec: PlanLineTextAnnotationSpec): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.2),
    estimateTextBounds({
      text: spec.text,
      x: spec.textPoint.x,
      y: spec.textPoint.y,
      anchor: spec.anchor ?? 'middle',
      fontHeight: 1.55,
      charWidth: 0.54,
      paddingX: 0.15,
      paddingY: 0.15,
    }),
  ]);
}


export function estimatePinnedSheetPlanPrimaryDimensionBounds(input: {
  rotatedPrimaryBounds: AnnotatedBounds;
  dimensionOffsets: { bottom: number; side: number };
  bottomLabel: string;
  leftLabel: string;
  presentation: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const pinnedBottomDimensionY = Math.min(87.4, input.rotatedPrimaryBounds.maxY + input.dimensionOffsets.bottom);
  const pinnedLeftDimensionX = input.rotatedPrimaryBounds.minX - input.dimensionOffsets.side;

  return unionBounds([
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.minX, pinnedBottomDimensionY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.maxX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.maxX, pinnedBottomDimensionY, 0.2),
    estimateTickDimensionBounds({
      x1: input.rotatedPrimaryBounds.minX,
      y1: pinnedBottomDimensionY,
      x2: input.rotatedPrimaryBounds.maxX,
      y2: pinnedBottomDimensionY,
      label: input.bottomLabel,
      presentation: input.presentation,
    }),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.minY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.minY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.maxY, 0.2),
    estimateTickDimensionBounds({
      x1: pinnedLeftDimensionX,
      y1: input.rotatedPrimaryBounds.minY,
      x2: pinnedLeftDimensionX,
      y2: input.rotatedPrimaryBounds.maxY,
      label: input.leftLabel,
      presentation: input.presentation,
    }),
  ]);
}




