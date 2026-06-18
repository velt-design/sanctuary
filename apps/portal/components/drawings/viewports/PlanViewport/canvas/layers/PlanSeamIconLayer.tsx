import type { MouseEvent } from 'react';
import type { PlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type { PlanSeamIconTarget } from '../../interactions/seams/seamIconTargets';
import lineweightStyles from '../planLineweights.module.css';

/**
 * PR-COMP-PHASE4b.3 (2026-06-18): interactive overlay layer that
 * renders the Join / Detach seam icons in plan view.
 *
 * One icon per target from `buildSeamIconTargets`:
 *   - 'detach' icons sit at the world-space midpoint of every
 *     internal seam of every composite. Click dispatches
 *     onDetach({ houseFormId, joinIndex }).
 *   - 'join' icons sit at the world-space midpoint of every
 *     edge-adjacent pair of separate forms. Click dispatches
 *     onJoin({ formAId, formBId }).
 *
 * Visual: small circular chip with a glyph (+ for Join, ⤴ for
 * Detach). Hover state lifts the chip; click triggers the action.
 * `stopPropagation` on the click event prevents the underlying
 * form hit-target from also receiving the click (which would
 * change selection instead of running the action).
 *
 * Mimics PlanSnapIndicatorLayer's render shape (data-plan-layer
 * attribute, world→SVG via coordinateAdapter, fixed(2) precision
 * on coordinates) but is INTERACTIVE — pointer-events: auto on
 * the icons themselves.
 */
export function PlanSeamIconLayer(props: {
  targets: ReadonlyArray<PlanSeamIconTarget>;
  coordinateAdapter: PlanCoordinateAdapter;
  onJoin?: (input: { formAId: string; formBId: string }) => void;
  onDetach?: (input: { houseFormId: string; joinIndex: number }) => void;
}) {
  const { targets, coordinateAdapter, onJoin, onDetach } = props;
  // Always render the layer wrapper (even when empty) so devtools
  // can inspect data-plan-seam-icon-count / data-plan-seam-icon-keys
  // to verify whether targets are being generated upstream.
  return (
    <g
      data-plan-layer="seamIcon"
      data-plan-seam-icon-count={targets.length}
      data-plan-seam-icon-keys={targets.map((target) => target.key).join(',')}
    >
      {targets.map((target) => {
        const svgPoint = coordinateAdapter.projectionToSvg({
          x: target.worldXMm,
          y: target.worldYMm,
        });
        const handleClick = (event: MouseEvent<SVGGElement>) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          if (target.kind === 'detach') {
            onDetach?.({
              houseFormId: target.houseFormId,
              joinIndex: target.joinIndex,
            });
          } else {
            onJoin?.({
              formAId: target.formAId,
              formBId: target.formBId,
            });
          }
        };
        const glyph = target.kind === 'detach' ? '–' : '+';
        const label = target.kind === 'detach' ? 'Detach this section' : 'Join these forms';
        return (
          <g
            key={target.key}
            data-plan-seam-icon-kind={target.kind}
            data-plan-seam-icon-key={target.key}
            transform={`translate(${svgPoint.x.toFixed(2)}, ${svgPoint.y.toFixed(2)})`}
            onMouseDown={(event) => {
              // Stop drag-start from picking up the underlying form
              // hit-target. The actual action runs on click; this
              // just prevents the form from entering move-mode.
              if (event.button === 0) event.stopPropagation();
            }}
            onClick={handleClick}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <title>{label}</title>
            <circle
              r="9"
              fill="#ffffff"
              stroke="var(--plan-stroke-snap, #ff6b00)"
              strokeWidth="1.5"
            />
            <text
              y="4"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="var(--plan-stroke-snap, #ff6b00)"
              className={lineweightStyles.snapIndicatorLabel}
              style={{ pointerEvents: 'none', stroke: 'none' }}
            >
              {glyph}
            </text>
          </g>
        );
      })}
    </g>
  );
}
