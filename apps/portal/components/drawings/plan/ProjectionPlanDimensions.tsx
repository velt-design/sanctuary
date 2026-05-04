import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';
import type { ProjectionPlanPoint, ProjectionPlanPreviewShape } from './ProjectionPlanLayers';

type ProjectionPlanDimensionAnnotation =
  | (ObjectWorkbenchPlanPresetDimensionAnnotation & {
      witnessStart: ProjectionPlanPoint;
      witnessEnd: ProjectionPlanPoint;
      lineStart: ProjectionPlanPoint;
      lineEnd: ProjectionPlanPoint;
    })
  | (ObjectWorkbenchPlanCustomEdgeCandidate & {
      witnessStart: ProjectionPlanPoint;
      witnessEnd: ProjectionPlanPoint;
      lineStart: ProjectionPlanPoint;
      lineEnd: ProjectionPlanPoint;
    });

function resolveTickDimensionGeometry(input: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = input.x2 - input.x1;
  const dy = input.y2 - input.y1;
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
  const cx = (input.x1 + input.x2) / 2;
  const cy = (input.y1 + input.y2) / 2;
  return {
    lineStartX: input.x1 - ux * 2.7,
    lineStartY: input.y1 - uy * 2.7,
    lineEndX: input.x2 + ux * 2.7,
    lineEndY: input.y2 + uy * 2.7,
    tick1StartX: input.x1 - tx,
    tick1StartY: input.y1 - ty,
    tick1EndX: input.x1 + tx,
    tick1EndY: input.y1 + ty,
    tick2StartX: input.x2 - tx,
    tick2StartY: input.y2 - ty,
    tick2EndX: input.x2 + tx,
    tick2EndY: input.y2 + ty,
    labelX: verticalBias ? cx - 2.78 : horizontalBias ? cx : cx - nx * 1.82,
    labelY: verticalBias ? cy : horizontalBias ? cy - 2.05 : cy - ny * 1.82,
    labelRotate: verticalBias ? -90 : undefined,
  };
}

function DimensionRenderer({
  annotation,
  onActivate,
}: {
  annotation: ProjectionPlanDimensionAnnotation;
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
  const geometry = resolveTickDimensionGeometry({
    x1: annotation.lineStart.x,
    y1: annotation.lineStart.y,
    x2: annotation.lineEnd.x,
    y2: annotation.lineEnd.y,
  });

  return (
    <g
      data-object-workbench-plan-dimension={annotation.id}
      data-object-workbench-dimension-emphasis={emphasis}
      data-house-first-plan-dimension={annotation.id}
      data-house-first-dimension-emphasis={emphasis}
      data-plan-layer="dimensions"
      data-plan-render-source="top_projection_committed"
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
      <line x1={geometry.lineStartX} y1={geometry.lineStartY} x2={geometry.lineEndX} y2={geometry.lineEndY} className={`${styles.moduleDimLine} ${lineClassName}`} />
      <line x1={geometry.tick1StartX} y1={geometry.tick1StartY} x2={geometry.tick1EndX} y2={geometry.tick1EndY} className={`${styles.moduleDimTick} ${tickClassName}`} />
      <line x1={geometry.tick2StartX} y1={geometry.tick2StartY} x2={geometry.tick2EndX} y2={geometry.tick2EndY} className={`${styles.moduleDimTick} ${tickClassName}`} />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        className={`${styles.moduleDimText} ${styles.moduleDimTextEditable} ${textClassName}`}
        transform={typeof geometry.labelRotate === 'number' ? `rotate(${geometry.labelRotate} ${geometry.labelX} ${geometry.labelY})` : undefined}
        data-editable-field-id={annotation.id}
        tabIndex={onActivate ? 0 : undefined}
        onClick={onActivate ? (event) => onActivate(annotation, event.currentTarget) : undefined}
        onKeyDown={
          onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onActivate(annotation, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {annotation.displayValue}
      </text>
    </g>
  );
}

export function ProjectionPlanDimensions({
  presetAnnotations,
  customEdgeCandidates,
  activeCustomEdgeId,
  previewShape,
  onCustomEdgeSelect,
  onDimensionActivate,
}: {
  presetAnnotations: ProjectionPlanDimensionAnnotation[];
  customEdgeCandidates: ProjectionPlanDimensionAnnotation[];
  activeCustomEdgeId: string | null;
  previewShape: ProjectionPlanPreviewShape;
  onCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
}) {
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
        <g key={`projection-custom-edge-${annotation.id}`}>
          <line
            x1={annotation.witnessStart.x}
            y1={annotation.witnessStart.y}
            x2={annotation.witnessEnd.x}
            y2={annotation.witnessEnd.y}
            data-object-workbench-custom-edge={annotation.id}
            data-house-first-custom-edge={annotation.id}
            data-plan-layer="selectionOutlines"
            data-plan-render-source="top_projection_committed"
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
            data-plan-render-source="top_projection_committed"
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
        <DimensionRenderer key={annotation.id} annotation={annotation} onActivate={onDimensionActivate} />
      ))}
      {visibleCustomEdgeCandidates
        .filter((annotation) => annotation.id === activeCustomEdgeId)
        .map((annotation) => (
          <DimensionRenderer key={annotation.id} annotation={annotation} onActivate={onDimensionActivate} />
        ))}
    </>
  );
}
