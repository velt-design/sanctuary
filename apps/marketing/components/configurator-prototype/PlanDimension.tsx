import { metres } from './model';
import type { PreviewDimensionAxis } from './usePreviewDimension';

export default function PlanDimension({ axis, value, active, start, end, offset, scale, compact = false }: {
  axis: PreviewDimensionAxis; value: number; active: boolean; start: number; end: number; offset: number; scale: number; compact?: boolean;
}) {
  const vertical = axis === 'projection';
  const centre = (start + end) / 2;
  const color = active ? '#4f5d45' : '#646c65';
  const tick = 5 / scale;
  const labelWidth = (compact ? 38 : 86) / scale, labelHeight = (compact ? 25 : 44) / scale;
  return <g data-plan-dimension={axis} data-active={active} aria-label={`${axis === 'width' ? 'Width' : 'Projection'} ${metres(value)}`}>
    <path d={vertical
      ? `M ${offset} ${start} V ${end} M ${offset - tick} ${start + tick} L ${offset + tick} ${start - tick} M ${offset - tick} ${end + tick} L ${offset + tick} ${end - tick}`
      : `M ${start} ${offset} H ${end} M ${start - tick} ${offset + tick} L ${start + tick} ${offset - tick} M ${end - tick} ${offset + tick} L ${end + tick} ${offset - tick}`}
      stroke={color} strokeWidth={active ? 1.6 : .8} vectorEffect="non-scaling-stroke" fill="none" />
    <g transform={vertical ? `translate(${offset}, ${centre})` : `translate(${centre}, ${offset})`}>
      <rect x={-labelWidth / 2} y={-labelHeight / 2} width={labelWidth} height={labelHeight}
        fill={active ? '#4f5d45' : '#e2e4df'} stroke="none" />
      <g textAnchor="middle" fill={active ? '#fff' : '#404a38'} fontFamily="Inter, sans-serif">
        <text y={(compact ? 4 : 0) / scale} fontSize={(compact ? 12 : 18) / scale} fontWeight={600}>{metres(value)}</text>
        {!compact && <text y={16 / scale} fontSize={9 / scale} letterSpacing={1 / scale}>{vertical ? 'PROJECTION' : 'WIDTH'}</text>}
      </g>
    </g>
  </g>;
}
