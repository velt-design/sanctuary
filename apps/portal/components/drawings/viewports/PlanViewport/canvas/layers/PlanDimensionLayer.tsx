import { memo } from 'react';
import type { PlanCoordinateAdapter, PlanSvgPoint } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import { resolvePlanDimensionGeometry, type PlanDimension } from '../planDimension';
import styles from '../planLineweights.module.css';

const ARROW_LENGTH_SVG = 6;
const ARROW_HALF_WIDTH_SVG = 2.5;
const LABEL_OFFSET_SVG = 4;

type DimensionRenderProps = {
  dimensions: ReadonlyArray<PlanDimension>;
  coordinateAdapter: PlanCoordinateAdapter;
};

function unitVector(from: PlanSvgPoint, to: PlanSvgPoint): { ux: number; uy: number } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { ux: dx / length, uy: dy / length };
}

function arrowPoints(tip: PlanSvgPoint, towards: PlanSvgPoint): string | null {
  const direction = unitVector(tip, towards);
  if (!direction) return null;
  const baseX = tip.x + direction.ux * ARROW_LENGTH_SVG;
  const baseY = tip.y + direction.uy * ARROW_LENGTH_SVG;
  const perpX = -direction.uy * ARROW_HALF_WIDTH_SVG;
  const perpY = direction.ux * ARROW_HALF_WIDTH_SVG;
  return [
    `${tip.x.toFixed(2)},${tip.y.toFixed(2)}`,
    `${(baseX + perpX).toFixed(2)},${(baseY + perpY).toFixed(2)}`,
    `${(baseX - perpX).toFixed(2)},${(baseY - perpY).toFixed(2)}`,
  ].join(' ');
}

export const PlanDimensionLayer = memo(function PlanDimensionLayer({ dimensions, coordinateAdapter }: DimensionRenderProps) {
  return (
    <g className={styles.dimensionLayer} data-plan-layer="dimensions">
      {dimensions.map((dimension) => {
        const geometry = resolvePlanDimensionGeometry(dimension, coordinateAdapter);
        if (!geometry) return null;
        const startArrow = arrowPoints(geometry.dimLine.from, geometry.dimLine.to);
        const endArrow = arrowPoints(geometry.dimLine.to, geometry.dimLine.from);
        const labelTransform = `rotate(${geometry.labelRotationDeg.toFixed(2)} ${geometry.labelAnchor.x.toFixed(2)} ${geometry.labelAnchor.y.toFixed(2)})`;
        return (
          <g
            key={dimension.id}
            data-plan-dimension-id={dimension.id}
            data-plan-dimension-length-mm={Math.round(geometry.lengthMm)}
          >
            <line
              className={styles.dimensionLine}
              x1={geometry.extensionStart.from.x}
              y1={geometry.extensionStart.from.y}
              x2={geometry.extensionStart.to.x}
              y2={geometry.extensionStart.to.y}
              data-plan-dimension-part="extension-start"
            />
            <line
              className={styles.dimensionLine}
              x1={geometry.extensionEnd.from.x}
              y1={geometry.extensionEnd.from.y}
              x2={geometry.extensionEnd.to.x}
              y2={geometry.extensionEnd.to.y}
              data-plan-dimension-part="extension-end"
            />
            <line
              className={styles.dimensionLine}
              x1={geometry.dimLine.from.x}
              y1={geometry.dimLine.from.y}
              x2={geometry.dimLine.to.x}
              y2={geometry.dimLine.to.y}
              data-plan-dimension-part="dim-line"
            />
            {startArrow ? (
              <polygon
                className={styles.dimensionArrow}
                points={startArrow}
                data-plan-dimension-part="arrow-start"
              />
            ) : null}
            {endArrow ? (
              <polygon
                className={styles.dimensionArrow}
                points={endArrow}
                data-plan-dimension-part="arrow-end"
              />
            ) : null}
            <text
              className={styles.dimensionLabel}
              x={geometry.labelAnchor.x}
              y={geometry.labelAnchor.y - LABEL_OFFSET_SVG}
              transform={labelTransform}
              data-plan-dimension-part="label"
            >
              {geometry.label}
            </text>
          </g>
        );
      })}
    </g>
  );
});
