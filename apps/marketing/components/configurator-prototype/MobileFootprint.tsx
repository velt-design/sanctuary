'use client';
import { useMemo } from 'react';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { solvePergolaPreview } from './solvePreview';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import css from './mobileFootprint.module.css';

/** Quiet footprint from the same solved plan as the full configurator. */
export default function MobileFootprint({ input, roof, activeDimension }: {
  input: SimpleCoverInput; roof: PreviewRoofChoices; activeDimension: PreviewDimensionAxis | null;
}) {
  const plan = useMemo(() => solvePergolaPreview(input, roof).geometry?.plan, [input, roof]);
  if (!plan) return <p className={css.unavailable}>Adjust your size to see the footprint.</p>;
  const { minX, minY, maxX, maxY } = plan.extents;
  const scale = Math.min(236 / Math.max(1, maxX - minX), 122 / Math.max(1, maxY - minY));
  const w = (maxX - minX) * scale, h = (maxY - minY) * scale;
  const left = 184 - w / 2, top = 113 - h / 2;
  const x = (value: number) => left + (value - minX) * scale;
  const y = (value: number) => top + (value - minY) * scale;
  const width = `${(input.widthMm / 1000).toFixed(1)} m`, projection = `${(input.projectionMm / 1000).toFixed(1)} m`;
  const attached = roof.attachmentIntent !== 'freestanding';
  return <svg className={css.plan} viewBox="0 0 340 230" role="img" aria-label={`Pergola footprint: width ${width}, projection ${projection}, ${attached ? 'attached to house' : 'freestanding'}`} data-mobile-footprint>
    <title>Overhead footprint</title>
    {attached && <g data-house-edge><rect x={left} y={top - 28} width={w} height={28} fill="#e4e5de" /><text x={184} y={top - 11} textAnchor="middle" className={css.house}>House</text></g>}
    <polygon points={plan.outline.map(p => `${x(p.x)},${y(p.y)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
    {plan.members.posts.map(post => <rect key={post.id} x={x(post.centerline.start.x) - 2.5} y={y(post.centerline.start.y) - 2.5} width="5" height="5" fill="currentColor" />)}
    <g className={css.dimension} data-active={activeDimension === 'width'}>
      <path d={`M ${left} ${top+h+7} V ${top+h+27} M ${left+w} ${top+h+7} V ${top+h+27} M ${left} ${top+h+21} H ${left+w}`} />
      <path d={`M ${left-3} ${top+h+24} l 6 -6 M ${left+w-3} ${top+h+24} l 6 -6`} />
      <text x={184} y={top+h+43} textAnchor="middle">Width {width}</text>
    </g>
    <g className={css.dimension} data-active={activeDimension === 'projection'}>
      <path d={`M ${left-7} ${top} H ${left-27} M ${left-7} ${top+h} H ${left-27} M ${left-21} ${top} V ${top+h}`} />
      <path d={`M ${left-24} ${top+3} l 6 -6 M ${left-24} ${top+h+3} l 6 -6`} />
      <text transform={`translate(${left-37} 113) rotate(-90)`} textAnchor="middle">Projection {projection}</text>
    </g>
  </svg>;
}
