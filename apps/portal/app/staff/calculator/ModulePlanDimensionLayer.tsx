import type { PointerEvent as ReactPointerEvent } from 'react';
import styles from './CalculatorGrid.module.css';
import { ArrowHead } from './ModulePlanAnnotations';
import { TickDimension, formatMetres, type Point } from './ModuleDrawingSurfacePrimitives';
import type {
  ModuleDrawingInteractiveFieldMap,
  ModuleDrawingPresentation,
  ModulePlanInteractionProps,
} from './ModuleDrawingContracts';

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type PlanResizeHandle = {
  fieldId: 'plan:lengthA' | 'plan:spanA';
  start: Point;
  end: Point;
  guideFrom: Point;
  guideTo: Point;
  axisX: number;
  axisY: number;
  minValueM: number;
  maxValueM: number;
};

type SheetFallAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  arrowHeads: Array<{ point: Point; direction: 'up' | 'down' | 'left' | 'right' }>;
  labelPoint: Point;
  label: string;
} | null;

type SheetSpacingAnnotationSpec = {
  witness1Start: Point;
  witness1End: Point;
  witness2Start: Point;
  witness2End: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
} | null;

type SheetInternalAngleAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  textPoint: Point;
  anchor?: 'start' | 'middle' | 'end';
  text: string;
} | null;

export type ModulePlanDimensionLayerProps = {
  aH: number;
  aW: number;
  bW: number;
  bottomDimensionField?: ModuleDrawingInteractiveFieldMap[string];
  bottomDimensionLabel: string;
  bottomY: number;
  dimBaseY: number;
  dimensionOffsets: { side: number; hipSide: number };
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  gutterW: number;
  isHipCorner: boolean;
  leftDimensionField?: ModuleDrawingInteractiveFieldMap[string];
  leftDimensionLabel: string;
  model: {
    lengthA: number;
    lengthB?: number | null;
    rafterSpacingA: number;
    spanA: number;
    spanB?: number | null;
  };
  planInteraction?: ModulePlanInteractionProps;
  planResizeHandles: PlanResizeHandle[];
  pinnedBottomDimensionY: number;
  pinnedLeftDimensionX: number;
  presentation: ModuleDrawingPresentation;
  rafterDimY: number;
  rafterXsA: number[];
  rotatedPrimaryBounds: Bounds;
  scale: number;
  secondaryDimY: number;
  sheetFallAnnotationSpec: SheetFallAnnotationSpec;
  sheetInternalAngleAnnotationSpec: SheetInternalAngleAnnotationSpec;
  sheetSpacingAnnotationSpec: SheetSpacingAnnotationSpec;
  showModelPrimaryDimensions: boolean;
  showModelSecondaryAnnotations: boolean;
  showPergolaGeometry: boolean;
  showPinnedSheetPrimaryDimensions: boolean;
  splitY: number;
  y: number;
  yBottomInner: number;
  x: number;
  allowPergolaModelEditing: boolean;
  scope: 'rotated' | 'sheet';
};

export function ModulePlanDimensionLayer({
  aH,
  aW,
  bW,
  bottomDimensionField,
  bottomDimensionLabel,
  bottomY,
  dimBaseY,
  dimensionOffsets,
  interactiveFields,
  gutterW,
  isHipCorner,
  leftDimensionField,
  leftDimensionLabel,
  model,
  planInteraction,
  planResizeHandles,
  pinnedBottomDimensionY,
  pinnedLeftDimensionX,
  presentation,
  rafterDimY,
  rafterXsA,
  rotatedPrimaryBounds,
  scale,
  secondaryDimY,
  sheetFallAnnotationSpec,
  sheetInternalAngleAnnotationSpec,
  sheetSpacingAnnotationSpec,
  showModelPrimaryDimensions,
  showModelSecondaryAnnotations,
  showPergolaGeometry,
  showPinnedSheetPrimaryDimensions,
  splitY,
  y,
  yBottomInner,
  x,
  allowPergolaModelEditing,
  scope,
}: ModulePlanDimensionLayerProps) {
  const interiorRafterXsA = rafterXsA.length > 2 ? rafterXsA.slice(1, -1) : [];

  if (scope === 'sheet') {
    return (
      <>
        {sheetInternalAngleAnnotationSpec ? (
          <g data-plan-angle-annotation="sheet">
            <line x1={sheetInternalAngleAnnotationSpec.lineStart.x} y1={sheetInternalAngleAnnotationSpec.lineStart.y} x2={sheetInternalAngleAnnotationSpec.lineEnd.x} y2={sheetInternalAngleAnnotationSpec.lineEnd.y} className={styles.modulePlanInternalAngle} />
            <text x={sheetInternalAngleAnnotationSpec.textPoint.x} y={sheetInternalAngleAnnotationSpec.textPoint.y} textAnchor={sheetInternalAngleAnnotationSpec.anchor} className={styles.modulePlanAngleText}>
              {sheetInternalAngleAnnotationSpec.text}
            </text>
          </g>
        ) : null}
        {sheetFallAnnotationSpec ? (
          <g data-plan-fall-annotation="sheet">
            <line x1={sheetFallAnnotationSpec.lineStart.x} y1={sheetFallAnnotationSpec.lineStart.y} x2={sheetFallAnnotationSpec.lineEnd.x} y2={sheetFallAnnotationSpec.lineEnd.y} className={styles.moduleFallLine} />
            {sheetFallAnnotationSpec.arrowHeads.map((arrowHead, index) => (
              <ArrowHead key={`sheet-plan-fall-arrow-${index}`} x={arrowHead.point.x} y={arrowHead.point.y} direction={arrowHead.direction} presentation={presentation} />
            ))}
            <text x={sheetFallAnnotationSpec.labelPoint.x} y={sheetFallAnnotationSpec.labelPoint.y} textAnchor="middle" className={`${styles.moduleFallLabel} ${styles.moduleFallLabelSheet}`}>
              {sheetFallAnnotationSpec.label}
            </text>
          </g>
        ) : null}
        {sheetSpacingAnnotationSpec ? (
          <g data-plan-rafter-spacing="sheet">
            <line x1={sheetSpacingAnnotationSpec.witness1Start.x} y1={sheetSpacingAnnotationSpec.witness1Start.y} x2={sheetSpacingAnnotationSpec.witness1End.x} y2={sheetSpacingAnnotationSpec.witness1End.y} className={styles.moduleDimWitness} />
            <line x1={sheetSpacingAnnotationSpec.witness2Start.x} y1={sheetSpacingAnnotationSpec.witness2Start.y} x2={sheetSpacingAnnotationSpec.witness2End.x} y2={sheetSpacingAnnotationSpec.witness2End.y} className={styles.moduleDimWitness} />
            <TickDimension x1={sheetSpacingAnnotationSpec.x1} y1={sheetSpacingAnnotationSpec.y1} x2={sheetSpacingAnnotationSpec.x2} y2={sheetSpacingAnnotationSpec.y2} label={sheetSpacingAnnotationSpec.label} presentation={presentation} />
          </g>
        ) : null}
        {showPinnedSheetPrimaryDimensions ? (
          <>
            <g data-plan-primary-dim="bottom">
              <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.maxY} x2={rotatedPrimaryBounds.minX} y2={pinnedBottomDimensionY} className={styles.moduleDimWitness} />
              <line x1={rotatedPrimaryBounds.maxX} y1={rotatedPrimaryBounds.maxY} x2={rotatedPrimaryBounds.maxX} y2={pinnedBottomDimensionY} className={styles.moduleDimWitness} />
              <TickDimension x1={rotatedPrimaryBounds.minX} y1={pinnedBottomDimensionY} x2={rotatedPrimaryBounds.maxX} y2={pinnedBottomDimensionY} label={bottomDimensionLabel} presentation={presentation} interactiveField={bottomDimensionField} />
            </g>
            <g data-plan-primary-dim="left">
              <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.minY} x2={pinnedLeftDimensionX} y2={rotatedPrimaryBounds.minY} className={styles.moduleDimWitness} />
              <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.maxY} x2={pinnedLeftDimensionX} y2={rotatedPrimaryBounds.maxY} className={styles.moduleDimWitness} />
              <TickDimension x1={pinnedLeftDimensionX} y1={rotatedPrimaryBounds.minY} x2={pinnedLeftDimensionX} y2={rotatedPrimaryBounds.maxY} label={leftDimensionLabel} presentation={presentation} interactiveField={leftDimensionField} />
            </g>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      {planResizeHandles.map((handle) => {
        const isActiveHandle = handle.fieldId === planInteraction?.activeResizeFieldId;
        const isHoveredHandle = handle.fieldId === planInteraction?.hoveredResizeFieldId;
        return (
          <g key={`plan-resize-${handle.fieldId}`}>
            <line
              x1={handle.guideFrom.x}
              y1={handle.guideFrom.y}
              x2={handle.guideTo.x}
              y2={handle.guideTo.y}
              className={isActiveHandle ? `${styles.moduleFootprintGuide} ${styles.moduleFootprintGuideActive}` : styles.moduleFootprintGuide}
            />
            <line
              x1={handle.start.x}
              y1={handle.start.y}
              x2={handle.end.x}
              y2={handle.end.y}
              data-plan-resize-handle={handle.fieldId}
              className={
                isActiveHandle
                  ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeActive}`
                  : isHoveredHandle
                    ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeHover}`
                    : styles.moduleFootprintResizeEdge
              }
            />
            <line
              x1={handle.start.x}
              y1={handle.start.y}
              x2={handle.end.x}
              y2={handle.end.y}
              data-plan-resize-handle-hit={handle.fieldId}
              className={styles.moduleFootprintResizeEdgeHit}
              onPointerEnter={() => planInteraction?.onResizeFieldHover(handle.fieldId)}
              onPointerLeave={() => planInteraction?.onResizeFieldHover(null)}
              onPointerDown={(event: ReactPointerEvent<SVGLineElement>) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                planInteraction?.onResizeFieldDragStart(
                  {
                    fieldId: handle.fieldId,
                    axisX: handle.axisX,
                    axisY: handle.axisY,
                    scale,
                    deltaMultiplier: 1,
                    minValueM: handle.minValueM,
                    maxValueM: handle.maxValueM,
                  },
                  {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                  },
                );
              }}
            />
          </g>
        );
      })}

      {showPinnedSheetPrimaryDimensions || !showModelPrimaryDimensions ? null : (
        <g data-plan-primary-dim="bottom">
          <line x1={x} y1={isHipCorner ? bottomY : y + aH} x2={x} y2={dimBaseY} className={styles.moduleDimWitness} />
          <line x1={x + aW} y1={isHipCorner ? splitY : y + aH} x2={x + aW} y2={dimBaseY} className={styles.moduleDimWitness} />
          <TickDimension
            x1={x}
            y1={dimBaseY}
            x2={x + aW}
            y2={dimBaseY}
            label={formatMetres(model.lengthA)}
            presentation={presentation}
            interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:lengthA'] : undefined}
          />
        </g>
      )}
      {showPinnedSheetPrimaryDimensions || !showModelPrimaryDimensions ? null : (
        <g data-plan-primary-dim="left">
          <line x1={x} y1={y} x2={x - dimensionOffsets.side} y2={y} className={styles.moduleDimWitness} />
          <line x1={x} y1={y + aH} x2={x - dimensionOffsets.side} y2={y + aH} className={styles.moduleDimWitness} />
          <TickDimension
            x1={x - dimensionOffsets.side}
            y1={y}
            x2={x - dimensionOffsets.side}
            y2={y + aH}
            label={formatMetres(model.spanA)}
            presentation={presentation}
            interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:spanA'] : undefined}
          />
        </g>
      )}
      {showPergolaGeometry && isHipCorner && model.lengthB && model.spanB ? (
        <>
          <line x1={x} y1={bottomY} x2={x} y2={secondaryDimY} className={styles.moduleDimWitness} />
          <line x1={x + bW} y1={bottomY} x2={x + bW} y2={secondaryDimY} className={styles.moduleDimWitness} />
          <TickDimension
            x1={x}
            y1={secondaryDimY}
            x2={x + bW}
            y2={secondaryDimY}
            label={formatMetres(model.lengthB)}
            presentation={presentation}
            interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:lengthB'] : undefined}
          />
          <line x1={x + bW} y1={splitY} x2={x + bW + dimensionOffsets.hipSide} y2={splitY} className={styles.moduleDimWitness} />
          <line x1={x + bW} y1={bottomY} x2={x + bW + dimensionOffsets.hipSide} y2={bottomY} className={styles.moduleDimWitness} />
          <TickDimension
            x1={x + bW + dimensionOffsets.hipSide}
            y1={splitY}
            x2={x + bW + dimensionOffsets.hipSide}
            y2={bottomY}
            label={formatMetres(model.spanB)}
            presentation={presentation}
            interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:spanB'] : undefined}
          />
        </>
      ) : null}
      {showModelSecondaryAnnotations && rafterXsA.length >= 2
        ? (() => {
            const spacingXs = interiorRafterXsA.length >= 2 ? interiorRafterXsA : rafterXsA;
            const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
            const d1 = spacingXs[baseIdx]!;
            const d2 = spacingXs[baseIdx + 1]!;
            return (
              <>
                <line x1={d1} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d1} y2={rafterDimY} className={styles.moduleDimWitness} />
                <line x1={d2} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d2} y2={rafterDimY} className={styles.moduleDimWitness} />
                <TickDimension
                  x1={d1}
                  y1={rafterDimY}
                  x2={d2}
                  y2={rafterDimY}
                  label={`${formatMetres(model.rafterSpacingA)} c/c`}
                  textY={rafterDimY - (presentation === 'sheet' ? 1.8 : 1.5)}
                  presentation={presentation}
                />
              </>
            );
          })()
        : null}

    </>
  );
}
