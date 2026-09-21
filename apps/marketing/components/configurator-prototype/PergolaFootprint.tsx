'use client';
import { useId, useMemo } from 'react';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { solvePergolaPreview } from './solvePreview';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import css from './mobileFootprint.module.css';
import { useFootprintScale } from './useFootprintScale';

/** Quiet footprint from the same solved plan as the full configurator. */
export default function PergolaFootprint({ input, displayInput = input, roof, activeDimension, resizing = false }: {
  resizing?: boolean;
  input: SimpleCoverInput; displayInput?: SimpleCoverInput; roof: PreviewRoofChoices; activeDimension: PreviewDimensionAxis | null;
}) {
  const patternId = useId();
  const geometry = useMemo(() => solvePergolaPreview(input, roof).geometry, [input, roof]);
  const plan = geometry?.plan;
  const rx=displayInput.widthMm/input.widthMm, ry=displayInput.projectionMm/input.projectionMm;
  const targetScale = plan ? Math.min(236 / Math.max(1, (plan.extents.maxX - plan.extents.minX)*rx), 122 / Math.max(1, (plan.extents.maxY - plan.extents.minY)*ry)) : 1;
  const scale = useFootprintScale(targetScale, resizing);
  if (!plan) return <p className={css.unavailable}>Adjust your size to see the footprint.</p>;
  const { minX, minY, maxX, maxY } = plan.extents;
  // During a drag, resize the last solved footprint. Member counts/constraints
  // reconcile once on release; no detailed geometry is rebuilt per input event.
  const w = (maxX - minX) * rx * scale, h = (maxY - minY) * ry * scale;
  const left = 184 - w / 2, top = 113 - h / 2;
  const x = (value: number) => left + (maxX - value) * rx * scale;
  const y = (value: number) => top + (value - minY) * ry * scale;
  const width = `${(displayInput.widthMm / 1000).toFixed(1)} m`, projection = `${(displayInput.projectionMm / 1000).toFixed(1)} m`;
  const attached = roof.attachmentIntent !== 'freestanding';
  const members = [...plan.members.rafters, ...plan.members.beams, ...plan.members.ledgers, ...plan.members.gutters, ...plan.members.ridge];
  const primary = new Set([...plan.members.beams, ...plan.members.ledgers, ...plan.members.gutters, ...plan.members.ridge].map(member => member.id));
  const rafters = new Set(plan.members.rafters.map(member => member.id));
  const solidRegions = geometry?.covering?.regions.filter(region => region.material === 'solid') ?? [];
  const points = (boundary: { x: number; y: number }[]) => boundary.map(p => `${x(p.x)},${y(p.y)}`).join(' ');
  return <svg className={css.plan} viewBox="0 0 340 230" role="img" aria-label={`Pergola footprint: width ${width}, projection ${projection}, ${attached ? 'attached to house' : 'freestanding'}`} data-mobile-footprint>
    <title>Overhead plan with rafters, beams, gutters and roof materials</title>
    <defs>
      <mask id={`${patternId}-visible-rafters`} maskUnits="userSpaceOnUse" x="0" y="0" width="340" height="230" style={{ maskType: 'luminance' }}>
        <rect width="340" height="230" fill="white" />
        {solidRegions.map(region => <polygon key={region.id} points={points(region.boundary)} fill="black" />)}
      </mask>
      <pattern id={`${patternId}-acrylic`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="9" height="9" fill="#e2edf0" />
        <path d="M 0 0 V 9" stroke="#7899a5" strokeOpacity=".2" strokeWidth=".5" />
      </pattern>
      <pattern id={`${patternId}-solid`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width="6" height="6" fill="#777b6d" fillOpacity=".035" />
        <path d="M 0 0 V 6" stroke="#777b6d" strokeOpacity=".25" strokeWidth=".5" />
      </pattern>
    </defs>
    {attached && <g data-house-edge><rect x={left} y={top - 28} width={w} height={28} fill="#e4e5de" /><text x={184} y={top - 11} textAnchor="middle" className={css.house}>House</text></g>}
    <polygon points={points(plan.outline)} fill={`url(#${patternId}-acrylic)`} stroke="currentColor" strokeWidth=".8" />
    {solidRegions.map(region => <g key={region.id} data-footprint-material="solid">
      <polygon points={points(region.boundary)} fill="#f1f0ea" />
      <polygon points={points(region.boundary)} fill={`url(#${patternId}-solid)`} />
    </g>)}
    {members.map(member => {
      const a = member.centerline.start, b = member.centerline.end;
      const dx = x(b.x) - x(a.x), dy = y(b.y) - y(a.y);
      const length = Math.hypot(dx, dy);
      if (!length) return null;
      // Retain the solved member width, with a legible minimum at phone scale.
      const half = Math.max(2, member.profile.widthMm * scale) / 2;
      const ox = -dy / length * half, oy = dx / length * half;
      return <polygon key={member.id} data-footprint-member={member.id}
        mask={rafters.has(member.id) ? `url(#${patternId}-visible-rafters)` : undefined}
        points={`${x(a.x)+ox},${y(a.y)+oy} ${x(b.x)+ox},${y(b.y)+oy} ${x(b.x)-ox},${y(b.y)-oy} ${x(a.x)-ox},${y(a.y)-oy}`}
        fill="#f1f0ea" stroke={primary.has(member.id) ? '#454c42' : '#747b70'} strokeWidth={primary.has(member.id) ? .75 : .55} />;
    })}
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
