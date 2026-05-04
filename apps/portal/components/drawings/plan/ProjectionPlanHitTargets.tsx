import {
  ProjectionHitTarget,
  type ProjectionPlanOverlayShape,
  type ProjectionPlanPreviewShape,
  type ProjectionPlanShapeDragStartMeta,
} from './ProjectionPlanLayers';

export function ProjectionPlanHitTargets({
  shapes,
  previewShape,
  hoveredDeckId,
  onDeckHoverChange,
  onShapeSelect,
  onShapeDragStart,
}: {
  shapes: ProjectionPlanOverlayShape[];
  previewShape: ProjectionPlanPreviewShape;
  hoveredDeckId?: string | null;
  onDeckHoverChange?: (deckId: string | null) => void;
  onShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onShapeDragStart?: (
    meta: ProjectionPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
}) {
  return (
    <>
      {shapes.map((shape) => (
        <ProjectionHitTarget
          key={`projection-hit-${shape.ownerKind}-${shape.ownerId}`}
          shape={shape}
          previewSuppressed={Boolean(
            previewShape &&
              previewShape.ownerKind === shape.ownerKind &&
              previewShape.ownerId === shape.ownerId &&
              previewShape.bodyState !== 'grabbed',
          )}
          hoveredDeckId={hoveredDeckId}
          onDeckHoverChange={onDeckHoverChange}
          onShapeSelect={onShapeSelect}
          onShapeDragStart={onShapeDragStart}
        />
      ))}
    </>
  );
}
