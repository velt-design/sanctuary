import type { PointerEventHandler } from 'react';
import styles from './CalculatorGrid.module.css';
import { planHouseLineClass, planHouseSurfaceClass } from './ModulePlanLayoutPresentation';
import { toPointsAttr, type Point } from './ModuleDrawingSurfacePrimitives';
import type {
  ProjectedSemanticPlanHouseLine,
  ProjectedSemanticPlanHouseSurface,
} from './ModulePlanSvgGeometryPresentation';

type ModulePlanHouseLayerProps = {
  effectiveHousePolygon: Point[];
  hasSemanticPlanHouseContext: boolean;
  hatchId: string;
  houseLabel: Point;
  isSheetFootprintEditor: boolean;
  renderLegacyHouseContext: boolean;
  semanticPlanHouseLines: ProjectedSemanticPlanHouseLine[];
  semanticPlanHouseSurfaces: ProjectedSemanticPlanHouseSurface[];
  showFootprintControls: boolean;
  showHouseHoverState: boolean;
  showHouseHoverTarget: boolean;
  showHouseLabel: boolean;
  onHouseContextHoverChange?: (hovered: boolean) => void;
};

export function ModulePlanHouseLayer({
  effectiveHousePolygon,
  hasSemanticPlanHouseContext,
  hatchId,
  houseLabel,
  isSheetFootprintEditor,
  renderLegacyHouseContext,
  semanticPlanHouseLines,
  semanticPlanHouseSurfaces,
  showFootprintControls,
  showHouseHoverState,
  showHouseHoverTarget,
  showHouseLabel,
  onHouseContextHoverChange,
}: ModulePlanHouseLayerProps) {
  const handleHousePointerEnter: PointerEventHandler<SVGPolygonElement> = () => onHouseContextHoverChange?.(true);
  const handleHousePointerLeave: PointerEventHandler<SVGPolygonElement> = () => onHouseContextHoverChange?.(false);

  return (
    <>
      {hasSemanticPlanHouseContext
        ? semanticPlanHouseSurfaces.map((surface) => (
            <polygon
              key={surface.id}
              points={toPointsAttr(surface.points)}
              className={
                surface.toned
                  ? `${planHouseSurfaceClass(surface.kind)} ${styles.modulePlanHouseSurfaceToned}`
                  : planHouseSurfaceClass(surface.kind)
              }
              data-house-plan-surface={surface.kind}
              data-house-plan-surface-id={surface.id}
            />
          ))
        : null}
      {hasSemanticPlanHouseContext
        ? semanticPlanHouseLines.map((line) => (
            <line
              key={line.id}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
              className={
                line.emphasized
                  ? `${planHouseLineClass(line.kind)} ${styles.modulePlanHouseLineEmphasized}`
                  : planHouseLineClass(line.kind)
              }
              data-house-plan-line={line.kind}
            />
          ))
        : null}
      {renderLegacyHouseContext && !hasSemanticPlanHouseContext ? (
        <polygon
          points={toPointsAttr(effectiveHousePolygon)}
          fill={`url(#${hatchId})`}
          className={`${styles.moduleHouseHatch} ${isSheetFootprintEditor ? styles.moduleHouseHatchSheetContext : ''} ${
            showHouseHoverState ? styles.moduleHouseHatchSheetHover : ''
          } ${showFootprintControls && isSheetFootprintEditor ? styles.moduleHouseHatchSheetEditing : ''}`}
        />
      ) : null}
      {showHouseHoverTarget ? (
        <polygon
          points={toPointsAttr(effectiveHousePolygon)}
          className={styles.moduleHouseContextHit}
          data-sheet-hover-target="house"
          onPointerEnter={handleHousePointerEnter}
          onPointerLeave={handleHousePointerLeave}
        />
      ) : null}
      {showHouseLabel ? (
        <text x={houseLabel.x} y={houseLabel.y} textAnchor="middle" dominantBaseline="middle" className={styles.moduleHouseLabel}>
          House side
        </text>
      ) : null}
    </>
  );
}
