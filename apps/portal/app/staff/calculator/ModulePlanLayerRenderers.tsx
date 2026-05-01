import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanOpeningInteraction,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { ObjectInteractionPreviewOverlay } from '@/lib/drawings/interactions/objectInteractionEngine';
import {
  topProjectionRole,
  topProjectionShapeVisualOwner,
  type ProjectionPlanLayer,
} from '@/lib/drawings/views/plan/planRenderGraph';
import styles from './CalculatorGrid.module.css';

export type ModulePlanLayerPoint = { x: number; y: number };

export type ModulePlanShapeDragStartMeta =
  | {
      ownerKind: 'deck';
      ownerId: string;
      overlayShape: ObjectWorkbenchPlanOverlay['shapes'][number] & {
        points: ModulePlanLayerPoint[];
        deckInteractionSvg?: (ObjectWorkbenchPlanDeckInteraction & {
          hostEdgeStart: ModulePlanLayerPoint;
          hostEdgeEnd: ModulePlanLayerPoint;
        }) | null;
      };
      deckInteraction: ObjectWorkbenchPlanDeckInteraction & {
        hostEdgeStart: ModulePlanLayerPoint;
        hostEdgeEnd: ModulePlanLayerPoint;
      };
    }
  | {
      ownerKind: 'opening';
      ownerId: string;
      openingInteraction: ObjectWorkbenchPlanOpeningInteraction & {
        hostEdgeStart: ModulePlanLayerPoint;
        hostEdgeEnd: ModulePlanLayerPoint;
      };
    };

export type TopProjectionLayerItem = {
  shape: GeometryTopProjectionShape;
  points: ModulePlanLayerPoint[];
  layer: ProjectionPlanLayer;
};

export type TopProjectionLayerRendererProps = {
  shapes: TopProjectionLayerItem[];
  projection: GeometryTopProjectionViewModel | null;
  hideHouseFootprint?: boolean;
  customPolygonOverrideActive?: boolean;
};

export type ObjectWorkbenchOverlayShape = ObjectWorkbenchPlanOverlay['shapes'][number] & {
  points: ModulePlanLayerPoint[];
  deckInteractionSvg?: (ObjectWorkbenchPlanDeckInteraction & {
    hostEdgeStart: ModulePlanLayerPoint;
    hostEdgeEnd: ModulePlanLayerPoint;
  }) | null;
};

export type ObjectWorkbenchPreviewShape = {
  ownerKind: 'deck' | 'opening';
  ownerId: string;
  points: ModulePlanLayerPoint[];
  bodyState: ObjectInteractionPreviewOverlay<ModulePlanLayerPoint>['bodyState'];
  anchorPoint: ModulePlanLayerPoint | null;
  referenceGuide: {
    start: ModulePlanLayerPoint;
    end: ModulePlanLayerPoint;
    state: NonNullable<ObjectInteractionPreviewOverlay<ModulePlanLayerPoint>['referenceGuide']>['state'];
  } | null;
  targetHighlights: Array<{ start: ModulePlanLayerPoint; end: ModulePlanLayerPoint; state: 'preview' | 'snap-available' | 'snapped' }>;
  lockedCornerPoint: ModulePlanLayerPoint | null;
  endCatchPoint: ModulePlanLayerPoint | null;
} | null;

export type ObjectWorkbenchCustomEdgeAnnotation = ObjectWorkbenchPlanCustomEdgeCandidate & {
  witnessStart: ModulePlanLayerPoint;
  witnessEnd: ModulePlanLayerPoint;
  lineStart: ModulePlanLayerPoint;
  lineEnd: ModulePlanLayerPoint;
};

export type ObjectWorkbenchPresetDimensionAnnotation = ObjectWorkbenchPlanPresetDimensionAnnotation & {
  witnessStart: ModulePlanLayerPoint;
  witnessEnd: ModulePlanLayerPoint;
  lineStart: ModulePlanLayerPoint;
  lineEnd: ModulePlanLayerPoint;
};

export type ObjectWorkbenchDimensionAnnotation =
  | ObjectWorkbenchCustomEdgeAnnotation
  | ObjectWorkbenchPresetDimensionAnnotation;

export type ObjectWorkbenchDimensionLayerRendererProps = {
  presetAnnotations: ObjectWorkbenchPresetDimensionAnnotation[];
  customEdgeCandidates: ObjectWorkbenchCustomEdgeAnnotation[];
  activeCustomEdgeId: string | null;
  previewShape: ObjectWorkbenchPreviewShape;
  onCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
};

export type ObjectWorkbenchOverlayLayerRendererProps = {
  shapes: ObjectWorkbenchOverlayShape[];
  renderCommittedBodies?: boolean;
  previewShape: ObjectWorkbenchPreviewShape;
  hoveredDeckId?: string | null;
  onDeckHoverChange?: (deckId: string | null) => void;
  onShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onShapeDragStart?: (
    meta: ModulePlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
};

export type ObjectWorkbenchPreviewLayerRendererProps = {
  previewShape: ObjectWorkbenchPreviewShape;
};

function toPointsAttr(points: ModulePlanLayerPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function planHouseSurfaceClass(kind: 'roof' | 'soffit' | 'fascia' | 'attachment_zone' | 'footprint'): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
}

function topProjectionShapeClass(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house') {
    if (shape.kind === 'deck') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseDeck}`;
    if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseOpening}`;
    }
    if (shape.kind === 'roof' || shape.kind === 'house_roof_material') return planHouseSurfaceClass('roof');
    if (shape.kind === 'soffit') return planHouseSurfaceClass('soffit');
    if (shape.kind === 'fascia') return planHouseSurfaceClass('fascia');
    if (shape.kind === 'attachment_zone') return planHouseSurfaceClass('attachment_zone');
    if (shape.kind === 'gutter' || shape.kind === 'roof_feature' || shape.kind === 'wall_segment') {
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanTopProjectionLine}`;
    }
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint} ${styles.modulePlanTopProjectionReference}`;
  }
  if (shape.family === 'reference') return styles.modulePlanTopProjectionReference;
  if (shape.kind === 'roof_cladding') return styles.modulePlanBoxInset;
  if (shape.kind === 'rafter') return styles.modulePlanRafter;
  if (shape.kind === 'ridge') return styles.modulePlanRidgeBand;
  if (shape.kind === 'post' || shape.kind === 'beam' || shape.kind === 'ledger' || shape.kind === 'gutter' || shape.kind === 'joiner') {
    return styles.modulePlanPrimaryZone;
  }
  return styles.modulePlanPrimaryZone;
}

function topProjectionShapeClassForLayer(shape: GeometryTopProjectionShape, layer: ProjectionPlanLayer): string {
  if (layer === 'contextLines') return styles.modulePlanTopProjectionLine;
  return topProjectionShapeClass(shape);
}

function objectWorkbenchShapeVisualOwner(shape: Pick<ObjectWorkbenchPlanOverlay['shapes'][number], 'ownerKind' | 'ownerId'>): string {
  if (shape.ownerKind === 'footprint') return 'house';
  return `${shape.ownerKind}:${shape.ownerId}`;
}

type TickDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  presentation?: 'model';
  interactiveField?: {
    fieldId: string;
    onActivate?: (fieldId: string, target: SVGTextElement) => void;
  };
  lineClassName?: string;
  tickClassName?: string;
  textClassName?: string;
};

function resolveTickDimensionGeometry({ x1, y1, x2, y2 }: TickDimensionProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = 0.96;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const horizontalBias = Math.abs(dx) >= Math.abs(dy) * 1.35;
  const verticalBias = Math.abs(dy) > Math.abs(dx) * 1.35;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return {
    lineStartX: x1 - ux * 2.7,
    lineStartY: y1 - uy * 2.7,
    lineEndX: x2 + ux * 2.7,
    lineEndY: y2 + uy * 2.7,
    tick1StartX: x1 - tx,
    tick1StartY: y1 - ty,
    tick1EndX: x1 + tx,
    tick1EndY: y1 + ty,
    tick2StartX: x2 - tx,
    tick2StartY: y2 - ty,
    tick2EndX: x2 + tx,
    tick2EndY: y2 + ty,
    labelX: verticalBias ? cx - 2.78 : horizontalBias ? cx : cx - nx * 1.82,
    labelY: verticalBias ? cy : horizontalBias ? cy - 2.05 : cy - ny * 1.82,
    labelRotate: verticalBias ? -90 : undefined,
  };
}

function TickDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  interactiveField,
  lineClassName,
  tickClassName,
  textClassName,
}: TickDimensionProps) {
  const geometry = resolveTickDimensionGeometry({ x1, y1, x2, y2, label });
  return (
    <g>
      <line
        x1={geometry.lineStartX}
        y1={geometry.lineStartY}
        x2={geometry.lineEndX}
        y2={geometry.lineEndY}
        className={[styles.moduleDimLine, lineClassName].filter(Boolean).join(' ')}
      />
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
        className={[styles.moduleDimText, interactiveField ? styles.moduleDimTextEditable : '', textClassName]
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

export function TopProjectionLayerRenderer({
  shapes,
  projection,
  hideHouseFootprint = false,
  customPolygonOverrideActive = false,
}: TopProjectionLayerRendererProps) {
  return (
    <>
      {shapes
        .filter(({ shape }) => !(shape.family === 'house' && shape.kind === 'footprint' && (hideHouseFootprint || customPolygonOverrideActive)))
        .map(({ shape, points, layer }) => (
          <polygon
            key={shape.id}
            points={toPointsAttr(points)}
            className={topProjectionShapeClassForLayer(shape, layer)}
            data-plan-layer={layer}
            data-plan-coordinate-space="top_projection_screen"
            data-plan-render-source={layer === 'committedBodies' ? 'top_projection_committed' : 'top_projection_context'}
            data-plan-visual-owner={topProjectionShapeVisualOwner(shape)}
            data-plan-top-projection-shape={shape.id}
            data-top-projection-source-object-id={shape.sourceObjectId}
            data-top-projection-source-id={shape.sourceId ?? ''}
            data-top-projection-source-type={shape.sourceType}
            data-top-projection-family={shape.family}
            data-top-projection-kind={shape.kind}
            data-top-projection-role={topProjectionRole(shape)}
            data-top-projection-z-min={shape.zMin ?? ''}
            data-top-projection-z-max={shape.zMax ?? ''}
            data-top-projection-screen-axis={
              projection ? `${projection.screenAxis.x}_${projection.screenAxis.y}` : undefined
            }
            data-house-plan-surface={
              shape.family === 'house' &&
              shape.kind !== 'gutter' &&
              shape.kind !== 'roof_feature' &&
              shape.kind !== 'attachment_target' &&
              shape.kind !== 'wall_segment'
                ? shape.kind
                : undefined
            }
            data-house-plan-line={
              shape.family === 'house' &&
              (shape.kind === 'gutter' ||
                shape.kind === 'roof_feature' ||
                shape.kind === 'attachment_target' ||
                shape.kind === 'wall_segment')
                ? shape.kind
                : undefined
            }
            data-plan-detail-role={typeof shape.metadata?.planDetailRole === 'string' ? shape.metadata.planDetailRole : undefined}
            data-plan-snap-role={typeof shape.metadata?.snapRole === 'string' ? shape.metadata.snapRole : undefined}
            data-plan-source-edge-id={typeof shape.metadata?.sourceEdgeId === 'string' ? shape.metadata.sourceEdgeId : undefined}
            data-plan-source-wall-id={typeof shape.metadata?.sourceWallId === 'string' ? shape.metadata.sourceWallId : undefined}
            data-plan-primary-fill={shape.family === 'pergola' && shape.kind === 'roof_plane' ? 'true' : undefined}
            data-plan-geometry-surface={shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding') ? shape.kind : undefined}
            data-plan-surface-id={shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding') ? shape.sourceId ?? shape.sourceObjectId : undefined}
            data-plan-member-id={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.sourceId ?? shape.sourceObjectId : undefined}
            data-plan-member-role={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.kind : undefined}
            data-plan-member-centerline-mm={typeof shape.metadata?.centerlineMm === 'string' ? shape.metadata.centerlineMm : undefined}
          />
        ))}
    </>
  );
}

export function ObjectWorkbenchPreviewLayerRenderer({ previewShape }: ObjectWorkbenchPreviewLayerRendererProps) {
  if (!previewShape) return null;
  return (
    <g
      data-object-workbench-preview-owner={previewShape.ownerId}
      data-object-workbench-preview-owner-kind={previewShape.ownerKind}
      data-house-first-preview-owner={previewShape.ownerId}
      data-house-first-preview-owner-kind={previewShape.ownerKind}
    >
      {previewShape.referenceGuide ? (
        <line
          x1={previewShape.referenceGuide.start.x}
          y1={previewShape.referenceGuide.start.y}
          x2={previewShape.referenceGuide.end.x}
          y2={previewShape.referenceGuide.end.y}
          data-object-workbench-reference-guide={previewShape.referenceGuide.state}
          data-house-first-reference-guide={previewShape.referenceGuide.state}
          data-plan-layer="dragPreview"
          className={
            previewShape.referenceGuide.state === 'snap-lane'
              ? `${styles.moduleHouseFirstPreviewGuide} ${styles.moduleHouseFirstPreviewGuideSnapLane}`
              : styles.moduleHouseFirstPreviewGuide
          }
        />
      ) : null}
      {previewShape.targetHighlights.map((targetHighlight, index) => (
        <line
          key={`house-first-preview-target-${previewShape.ownerId}-${index + 1}`}
          x1={targetHighlight.start.x}
          y1={targetHighlight.start.y}
          x2={targetHighlight.end.x}
          y2={targetHighlight.end.y}
          data-object-workbench-snap-target={targetHighlight.state}
          data-house-first-snap-target={targetHighlight.state}
          data-plan-layer="dragPreview"
          className={
            targetHighlight.state === 'snapped'
              ? `${styles.moduleHouseFirstSnapTarget} ${styles.moduleHouseFirstSnapTargetSnapped}`
              : targetHighlight.state === 'snap-available'
                ? `${styles.moduleHouseFirstSnapTarget} ${styles.moduleHouseFirstSnapTargetAvailable}`
                : styles.moduleHouseFirstSnapTarget
          }
        />
      ))}
      {previewShape.lockedCornerPoint ? (
        <circle
          cx={previewShape.lockedCornerPoint.x}
          cy={previewShape.lockedCornerPoint.y}
          r={0.92}
          data-object-workbench-preview-corner-lock={previewShape.bodyState}
          data-house-first-preview-corner-lock={previewShape.bodyState}
          data-plan-layer="dragPreview"
          className={styles.moduleHouseFirstPreviewCornerLock}
        />
      ) : null}
      {previewShape.endCatchPoint ? (
        <circle
          cx={previewShape.endCatchPoint.x}
          cy={previewShape.endCatchPoint.y}
          r={0.82}
          data-object-workbench-preview-end-catch={previewShape.bodyState}
          data-house-first-preview-end-catch={previewShape.bodyState}
          data-plan-layer="dragPreview"
          className={styles.moduleHouseFirstPreviewEndCatch}
        />
      ) : null}
      {previewShape.bodyState === 'grabbed' ? null : (
        <polygon
          points={toPointsAttr(previewShape.points)}
          data-object-workbench-preview-shape={previewShape.ownerId}
          data-house-first-preview-shape={previewShape.ownerId}
          data-object-workbench-preview-body-state={previewShape.bodyState}
          data-house-first-preview-body-state={previewShape.bodyState}
          data-plan-layer="dragPreview"
          className={[
            styles.moduleHouseFirstPreviewShape,
            previewShape.bodyState === 'snap-available'
              ? styles.moduleHouseFirstPreviewShapeAvailable
              : previewShape.bodyState === 'snapped'
                ? styles.moduleHouseFirstPreviewShapeSnapped
                : previewShape.bodyState === 'blocked'
                  ? styles.moduleHouseFirstPreviewShapeBlocked
                  : previewShape.bodyState === 'settling'
                    ? styles.moduleHouseFirstPreviewShapeSettling
                    : styles.moduleHouseFirstPreviewShapeFloating,
          ].join(' ')}
        />
      )}
      {previewShape.anchorPoint ? (
        <circle
          cx={previewShape.anchorPoint.x}
          cy={previewShape.anchorPoint.y}
          r={1.05}
          data-object-workbench-preview-anchor={previewShape.bodyState}
          data-house-first-preview-anchor={previewShape.bodyState}
          data-plan-layer="dragPreview"
          className={
            previewShape.bodyState === 'blocked'
              ? `${styles.moduleHouseFirstPreviewAnchor} ${styles.moduleHouseFirstPreviewAnchorBlocked}`
              : previewShape.bodyState === 'grabbed'
                ? `${styles.moduleHouseFirstPreviewAnchor} ${styles.moduleHouseFirstPreviewAnchorGrabbed}`
                : styles.moduleHouseFirstPreviewAnchor
          }
        />
      ) : null}
    </g>
  );
}

export function ObjectWorkbenchDimensionLayerRenderer({
  presetAnnotations,
  customEdgeCandidates,
  activeCustomEdgeId,
  previewShape,
  onCustomEdgeSelect,
  onDimensionActivate,
}: ObjectWorkbenchDimensionLayerRendererProps) {
  const previewSuppressedOwner =
    previewShape?.ownerKind === 'deck' && previewShape.bodyState !== 'grabbed'
      ? { ownerKind: previewShape.ownerKind, ownerId: previewShape.ownerId }
      : null;
  const isPreviewSuppressedOwner = (ownerKind: 'footprint' | 'deck' | 'opening', ownerId: string) =>
    previewSuppressedOwner?.ownerKind === ownerKind && previewSuppressedOwner.ownerId === ownerId;
  const visibleCustomEdgeCandidates = previewSuppressedOwner
    ? customEdgeCandidates.filter((annotation) => !isPreviewSuppressedOwner(annotation.ownerKind, annotation.ownerId))
    : customEdgeCandidates;
  const visiblePresetAnnotations = previewSuppressedOwner
    ? presetAnnotations.filter((annotation) => !isPreviewSuppressedOwner(annotation.ownerKind, annotation.ownerId))
    : presetAnnotations;

  return (
    <>
      {visibleCustomEdgeCandidates.map((annotation) => (
        <g key={`house-first-edge-${annotation.id}`}>
          <line
            x1={annotation.witnessStart.x}
            y1={annotation.witnessStart.y}
            x2={annotation.witnessEnd.x}
            y2={annotation.witnessEnd.y}
            data-object-workbench-custom-edge={annotation.id}
            data-house-first-custom-edge={annotation.id}
            data-plan-layer="selectionOutlines"
            className={
              annotation.id === activeCustomEdgeId
                ? `${styles.moduleHouseFirstCustomEdge} ${styles.moduleHouseFirstCustomEdgeActive}`
                : styles.moduleHouseFirstCustomEdge
            }
          />
          <line
            x1={annotation.witnessStart.x}
            y1={annotation.witnessStart.y}
            x2={annotation.witnessEnd.x}
            y2={annotation.witnessEnd.y}
            data-object-workbench-custom-edge-hit={annotation.id}
            data-house-first-custom-edge-hit={annotation.id}
            data-plan-layer="hitTargets"
            className={styles.moduleHouseFirstCustomEdgeHit}
            onClick={() =>
              onCustomEdgeSelect?.({
                ownerKind: annotation.ownerKind,
                ownerId: annotation.ownerId,
                edgeIndex: annotation.edgeIndex,
              })
            }
          />
        </g>
      ))}
      {visiblePresetAnnotations.map((annotation) => (
        <ObjectWorkbenchDimensionRenderer
          key={annotation.id}
          annotation={annotation}
          onActivate={onDimensionActivate}
        />
      ))}
      {visibleCustomEdgeCandidates
        .filter((annotation) => annotation.id === activeCustomEdgeId)
        .map((annotation) => (
          <ObjectWorkbenchDimensionRenderer
            key={annotation.id}
            annotation={annotation}
            onActivate={onDimensionActivate}
          />
        ))}
    </>
  );
}

function ObjectWorkbenchDimensionRenderer({
  annotation,
  onActivate,
}: {
  annotation: ObjectWorkbenchDimensionAnnotation;
  onActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
}) {
  const emphasis =
    'emphasis' in annotation ? annotation.emphasis : annotation.targetKind === 'deck_custom_edge' ? 'relationship' : 'driving';
  const lineClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionLine
      : styles.moduleHouseFirstDrivingDimensionLine;
  const tickClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionTick
      : styles.moduleHouseFirstDrivingDimensionTick;
  const textClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionText
      : styles.moduleHouseFirstDrivingDimensionText;
  return (
    <g
      data-object-workbench-plan-dimension={annotation.id}
      data-object-workbench-dimension-emphasis={emphasis}
      data-house-first-plan-dimension={annotation.id}
      data-house-first-dimension-emphasis={emphasis}
      data-plan-layer="dimensions"
    >
      <line
        x1={annotation.witnessStart.x}
        y1={annotation.witnessStart.y}
        x2={annotation.lineStart.x}
        y2={annotation.lineStart.y}
        className={
          emphasis === 'relationship'
            ? `${styles.moduleDimWitness} ${styles.moduleHouseFirstRelationshipWitness}`
            : `${styles.moduleDimWitness} ${styles.moduleHouseFirstDrivingWitness}`
        }
      />
      <line
        x1={annotation.witnessEnd.x}
        y1={annotation.witnessEnd.y}
        x2={annotation.lineEnd.x}
        y2={annotation.lineEnd.y}
        className={
          emphasis === 'relationship'
            ? `${styles.moduleDimWitness} ${styles.moduleHouseFirstRelationshipWitness}`
            : `${styles.moduleDimWitness} ${styles.moduleHouseFirstDrivingWitness}`
        }
      />
      <TickDimension
        x1={annotation.lineStart.x}
        y1={annotation.lineStart.y}
        x2={annotation.lineEnd.x}
        y2={annotation.lineEnd.y}
        label={annotation.displayValue}
        presentation="model"
        lineClassName={lineClassName}
        tickClassName={tickClassName}
        textClassName={textClassName}
        interactiveField={
          onActivate
            ? {
                fieldId: annotation.id,
                onActivate: (_fieldId, target) => onActivate(annotation, target),
              }
            : undefined
        }
      />
    </g>
  );
}

export function ObjectWorkbenchOverlayLayerRenderer({
  shapes,
  renderCommittedBodies = true,
  previewShape,
  hoveredDeckId,
  onDeckHoverChange,
  onShapeSelect,
  onShapeDragStart,
}: ObjectWorkbenchOverlayLayerRendererProps) {
  const previewSuppressedOwner =
    previewShape?.ownerKind === 'deck' && previewShape.bodyState !== 'grabbed'
      ? { ownerKind: previewShape.ownerKind, ownerId: previewShape.ownerId }
      : null;
  const isPreviewSuppressedOwner = (ownerKind: 'footprint' | 'deck' | 'opening', ownerId: string) =>
    previewSuppressedOwner?.ownerKind === ownerKind && previewSuppressedOwner.ownerId === ownerId;

  return (
    <>
      {shapes.map((shape) => {
        const previewSuppressed = isPreviewSuppressedOwner(shape.ownerKind, shape.ownerId);
        const detailSegments = shape.detailSegments ?? [];
        return (
          <g key={`house-first-shape-${shape.ownerKind}-${shape.ownerId}`}>
            {renderCommittedBodies ? (
              <polygon
                points={toPointsAttr(shape.points)}
                data-object-workbench-shape={`${shape.ownerKind}:${shape.ownerId}`}
                data-house-first-shape={`${shape.ownerKind}:${shape.ownerId}`}
                data-plan-coordinate-space="model_svg"
                data-plan-render-source={shape.source}
                data-plan-visual-owner={objectWorkbenchShapeVisualOwner(shape)}
                data-object-workbench-shape-visual="true"
                data-object-workbench-shape-muted={shape.muted ? 'true' : 'false'}
                data-house-first-shape-muted={shape.muted ? 'true' : 'false'}
                data-object-workbench-shape-invalid={shape.invalid ? 'true' : 'false'}
                data-house-first-shape-invalid={shape.invalid ? 'true' : 'false'}
                data-object-workbench-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                data-house-first-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                data-object-workbench-shape-hovered={
                  shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : 'false'
                }
                data-house-first-shape-hovered={
                  shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : 'false'
                }
                className={[
                  shape.ownerKind === 'deck' || shape.ownerKind === 'opening'
                    ? styles.moduleHouseFirstDeckShape
                    : styles.moduleHouseFirstFootprintShape,
                  shape.muted ? styles.moduleHouseFirstShapeMuted : '',
                  shape.invalid ? styles.moduleHouseFirstShapeInvalid : '',
                  shape.selected ? styles.moduleHouseFirstShapeSelected : '',
                  shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? styles.moduleHouseFirstShapeHovered : '',
                  previewSuppressed ? styles.moduleHouseFirstShapePreviewSuppressed : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ) : null}
            {!renderCommittedBodies && shape.selected ? (
              <polygon
                points={toPointsAttr(shape.points)}
                data-plan-layer="selectionOutlines"
                data-plan-coordinate-space="model_svg"
                data-plan-render-source={shape.source}
                data-plan-visual-owner={objectWorkbenchShapeVisualOwner(shape)}
                data-object-workbench-selection-outline={`${shape.ownerKind}:${shape.ownerId}`}
                data-house-first-selection-outline={`${shape.ownerKind}:${shape.ownerId}`}
                className={styles.moduleHouseFirstSelectionOutline}
              />
            ) : null}
            {!renderCommittedBodies || previewSuppressed ? null : detailSegments.map((segment, index) => (
              <line
                key={`house-first-shape-detail-${shape.ownerKind}-${shape.ownerId}-${index + 1}`}
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                className={styles.moduleHouseFirstOpeningDetail}
              />
            ))}
            <ObjectWorkbenchHitTarget
              shape={shape}
              renderCommittedBodies={renderCommittedBodies}
              previewSuppressed={previewSuppressed}
              hoveredDeckId={hoveredDeckId}
              onDeckHoverChange={onDeckHoverChange}
              onShapeSelect={onShapeSelect}
              onShapeDragStart={onShapeDragStart}
            />
            {!previewSuppressed && (shape.ownerKind === 'deck' || shape.ownerKind === 'opening') && shape.selected && shape.invalid ? (
              <text
                x={shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(shape.points.length, 1)}
                y={shape.points.reduce((sum, point) => sum + point.y, 0) / Math.max(shape.points.length, 1)}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.moduleHouseFirstInvalidBadge}
              >
                {shape.invalidMessage?.includes('house interior')
                  ? 'Inside house'
                  : shape.invalidMessage?.includes('overlap each other')
                    ? 'Overlaps deck'
                    : shape.invalidMessage?.includes('host edge')
                      ? 'Missing host edge'
                      : shape.ownerKind === 'opening'
                        ? 'Invalid opening'
                        : 'Invalid deck'}
              </text>
            ) : null}
            {!previewSuppressed &&
            (shape.ownerKind === 'deck' || shape.ownerKind === 'opening') &&
            shape.selected &&
            (shape.ownerKind === 'deck' ? shape.deckDragEligibility : shape.openingDragEligibility) ? (
              <text
                x={shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(shape.points.length, 1)}
                y={Math.min(...shape.points.map((point) => point.y)) - 1.8}
                textAnchor="middle"
                className={
                  (shape.ownerKind === 'deck' ? shape.deckDragEligibility?.eligible : shape.openingDragEligibility?.eligible)
                    ? styles.moduleHouseFirstDraggableBadge
                    : styles.moduleHouseFirstDeferredBadge
                }
              >
                {(shape.ownerKind === 'deck' ? shape.deckDragEligibility?.eligible : shape.openingDragEligibility?.eligible)
                  ? shape.ownerKind === 'deck'
                    ? 'Drag deck'
                    : 'Drag opening'
                  : 'Blocked'}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function ObjectWorkbenchHitTarget({
  shape,
  renderCommittedBodies,
  previewSuppressed,
  hoveredDeckId,
  onDeckHoverChange,
  onShapeSelect,
  onShapeDragStart,
}: {
  shape: ObjectWorkbenchOverlayShape;
  renderCommittedBodies: boolean;
  previewSuppressed: boolean;
  hoveredDeckId?: string | null;
  onDeckHoverChange?: (deckId: string | null) => void;
  onShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onShapeDragStart?: (
    meta: ModulePlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
}) {
  const handlePointerDown = (event: ReactPointerEvent<SVGPolygonElement>) => {
    if (event.button !== 0) return;
    if (shape.ownerKind === 'deck' && shape.deckInteraction) {
      event.preventDefault();
      event.stopPropagation();
      onDeckHoverChange?.(shape.ownerId);
      if (!shape.selected) {
        onShapeSelect?.({ ownerKind: shape.ownerKind, ownerId: shape.ownerId });
      }
      onShapeDragStart?.(
        {
          ownerKind: 'deck',
          ownerId: shape.ownerId,
          overlayShape: shape,
          deckInteraction: shape.deckInteractionSvg ?? shape.deckInteraction,
        },
        {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        },
      );
      return;
    }
    if (!shape.selected) return;
    if (shape.ownerKind === 'opening' && shape.openingInteraction) {
      onShapeDragStart?.(
        {
          ownerKind: 'opening',
          ownerId: shape.ownerId,
          openingInteraction: {
            ...shape.openingInteraction,
            hostEdgeStart: shape.openingInteraction.hostEdgeStart,
            hostEdgeEnd: shape.openingInteraction.hostEdgeEnd,
          },
        },
        {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        },
      );
    }
  };

  return (
    <polygon
      points={toPointsAttr(shape.points)}
      data-object-workbench-shape={!renderCommittedBodies ? `${shape.ownerKind}:${shape.ownerId}` : undefined}
      data-house-first-shape={!renderCommittedBodies ? `${shape.ownerKind}:${shape.ownerId}` : undefined}
      data-plan-layer="hitTargets"
      data-plan-coordinate-space="model_svg"
      data-plan-render-source={shape.source}
      data-plan-visual-owner={objectWorkbenchShapeVisualOwner(shape)}
      data-object-workbench-shape-visual={!renderCommittedBodies ? 'false' : undefined}
      data-object-workbench-shape-muted={!renderCommittedBodies ? (shape.muted ? 'true' : 'false') : undefined}
      data-house-first-shape-muted={!renderCommittedBodies ? (shape.muted ? 'true' : 'false') : undefined}
      data-object-workbench-shape-invalid={!renderCommittedBodies ? (shape.invalid ? 'true' : 'false') : undefined}
      data-house-first-shape-invalid={!renderCommittedBodies ? (shape.invalid ? 'true' : 'false') : undefined}
      data-object-workbench-shape-preview-suppressed={!renderCommittedBodies ? (previewSuppressed ? 'true' : 'false') : undefined}
      data-house-first-shape-preview-suppressed={!renderCommittedBodies ? (previewSuppressed ? 'true' : 'false') : undefined}
      data-object-workbench-shape-hovered={
        !renderCommittedBodies && shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined
      }
      data-house-first-shape-hovered={
        !renderCommittedBodies && shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined
      }
      data-object-workbench-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
      data-house-first-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
      data-object-workbench-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-house-first-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-object-workbench-shape-draggable={
        shape.ownerKind === 'deck'
          ? shape.deckDragEligibility?.eligible
            ? 'true'
            : 'false'
          : shape.ownerKind === 'opening'
            ? shape.openingDragEligibility?.eligible
              ? 'true'
              : 'false'
            : 'false'
      }
      data-house-first-shape-draggable={
        shape.ownerKind === 'deck'
          ? shape.deckDragEligibility?.eligible
            ? 'true'
            : 'false'
          : shape.ownerKind === 'opening'
            ? shape.openingDragEligibility?.eligible
              ? 'true'
              : 'false'
            : 'false'
      }
      data-object-workbench-shape-drag-reason={
        shape.ownerKind === 'deck'
          ? (shape.deckDragEligibility?.reason ?? '')
          : shape.ownerKind === 'opening'
            ? (shape.openingDragEligibility?.reason ?? '')
            : ''
      }
      data-house-first-shape-drag-reason={
        shape.ownerKind === 'deck'
          ? (shape.deckDragEligibility?.reason ?? '')
          : shape.ownerKind === 'opening'
            ? (shape.openingDragEligibility?.reason ?? '')
            : ''
      }
      className={styles.moduleHouseFirstShapeHit}
      onClick={() => onShapeSelect?.({ ownerKind: shape.ownerKind, ownerId: shape.ownerId })}
      onPointerEnter={() => {
        if (shape.ownerKind !== 'deck') return;
        onDeckHoverChange?.(shape.ownerId);
      }}
      onPointerMove={() => {
        if (shape.ownerKind !== 'deck') return;
        onDeckHoverChange?.(shape.ownerId);
      }}
      onPointerLeave={() => {
        if (shape.ownerKind !== 'deck') return;
        onDeckHoverChange?.(null);
      }}
      onPointerDown={handlePointerDown}
    />
  );
}
