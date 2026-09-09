import { metres } from './model';
import type { PreviewDimensionAxis } from './usePreviewDimension';

export default function PlanDimension({ axis, value, active, start, end, offset, scale, compact = false }: {
  axis: PreviewDimensionAxis; value: number; active: boolean; start: number; end: number; offset: number; scale: number; compact?: boolean;
}) {
  const vertical = axis === 'projection';
  const centre = (start + end) / 2;
  const color = active ? '#4f5d45' : '#929b89';
  const tick = 5 / scale;
  const labelWidth = (compact ? 54 : vertical ? 86 : 70) / scale, labelHeight = (compact ? 21 : 33) / scale;
  return <g data-plan-dimension={axis} data-active={active} aria-label={`${axis === 'width' ? 'Width' : 'Projection'} ${metres(value)}`}>
    <path d={vertical
      ? `M ${offset} ${start} V ${end} M ${offset - tick} ${start + tick} L ${offset + tick} ${start - tick} M ${offset - tick} ${end + tick} L ${offset + tick} ${end - tick}`
      : `M ${start} ${offset} H ${end} M ${start - tick} ${offset + tick} L ${start + tick} ${offset - tick} M ${end - tick} ${offset + tick} L ${end + tick} ${offset - tick}`}
      stroke={color} strokeWidth={active ? 1.6 : .8} vectorEffect="non-scaling-stroke" fill="none" />
    <g transform={vertical ? `translate(${offset}, ${centre}) rotate(-90)` : `translate(${centre}, ${offset})`}>
      <rect x={-labelWidth / 2} y={-labelHeight / 2} width={labelWidth} height={labelHeight}
        rx={3 / scale} fill={active ? '#4f5d45' : '#f3f3ed'} stroke={active ? '#4f5d45' : '#cbd0c3'} strokeWidth={.8} vectorEffect="non-scaling-stroke" />
      <g textAnchor="middle" fill={active ? '#fff' : '#404a38'} fontFamily="Inter, sans-serif">
        {!compact && <text y={-4 / scale} fontSize={8 / scale} letterSpacing={.8 / scale}>{vertical ? 'PROJECTION' : 'WIDTH'}</text>}
        <text y={(compact ? 4 : 10) / scale} fontSize={12 / scale} fontWeight={550}>{metres(value)}</text>
      </g>
    </g>
  </g>;
}
