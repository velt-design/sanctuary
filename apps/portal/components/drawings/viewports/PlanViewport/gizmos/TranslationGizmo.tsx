import type { PlanPoint } from '../interactions/dragLifecycle';
import styles from './TranslationGizmo.module.css';

export type TranslationGizmoBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TranslationGizmoProps = {
  bounds: TranslationGizmoBounds;
  delta?: PlanPoint;
  handleSizeMm?: number;
};

const DEFAULT_HANDLE_SIZE_MM = 80;

function offsetBounds(bounds: TranslationGizmoBounds, delta: PlanPoint): TranslationGizmoBounds {
  return {
    minX: bounds.minX + delta.x,
    minY: bounds.minY + delta.y,
    maxX: bounds.maxX + delta.x,
    maxY: bounds.maxY + delta.y,
  };
}

function handlesFor(bounds: TranslationGizmoBounds): Array<{ id: string; x: number; y: number }> {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return [
    { id: 'nw', x: bounds.minX, y: bounds.minY },
    { id: 'ne', x: bounds.maxX, y: bounds.minY },
    { id: 'se', x: bounds.maxX, y: bounds.maxY },
    { id: 'sw', x: bounds.minX, y: bounds.maxY },
    { id: 'n', x: cx, y: bounds.minY },
    { id: 'e', x: bounds.maxX, y: cy },
    { id: 's', x: cx, y: bounds.maxY },
    { id: 'w', x: bounds.minX, y: cy },
  ];
}

export function TranslationGizmo({
  bounds,
  delta = { x: 0, y: 0 },
  handleSizeMm = DEFAULT_HANDLE_SIZE_MM,
}: TranslationGizmoProps) {
  const offset = offsetBounds(bounds, delta);
  const width = offset.maxX - offset.minX;
  const height = offset.maxY - offset.minY;
  const cx = (offset.minX + offset.maxX) / 2;
  const cy = (offset.minY + offset.maxY) / 2;
  const handleHalf = handleSizeMm / 2;

  return (
    <g
      className={styles.gizmo}
      data-plan-layer="translationGizmo"
      data-translation-gizmo="true"
      data-translation-gizmo-active={delta.x !== 0 || delta.y !== 0 ? 'true' : 'false'}
    >
      <rect
        className={styles.outline}
        x={offset.minX}
        y={offset.minY}
        width={width}
        height={height}
        fill="none"
        data-translation-gizmo-outline="true"
      />
      <line
        className={styles.crosshair}
        x1={cx - handleHalf}
        y1={cy}
        x2={cx + handleHalf}
        y2={cy}
      />
      <line
        className={styles.crosshair}
        x1={cx}
        y1={cy - handleHalf}
        x2={cx}
        y2={cy + handleHalf}
      />
      {handlesFor(offset).map((handle) => (
        <rect
          key={handle.id}
          className={styles.handle}
          x={handle.x - handleHalf}
          y={handle.y - handleHalf}
          width={handleSizeMm}
          height={handleSizeMm}
          data-translation-gizmo-handle={handle.id}
        />
      ))}
    </g>
  );
}
