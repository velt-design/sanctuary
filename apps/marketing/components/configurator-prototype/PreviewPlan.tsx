import { useLayoutEffect, useRef, useState } from 'react';
import type { GeometryPlanViewModel, RepresentativeSurroundings, RoofFlashing3D } from '@sp/geometry';
import { metres } from './model';
import styles from './prototype.module.css';
import PlanDimension from './PlanDimension';
import type { PreviewDimensionAxis } from './usePreviewDimension';

export default function PreviewPlan({ plan, flashings = [], context, activeDimension }: { plan: GeometryPlanViewModel; flashings?: RoofFlashing3D[]; context: RepresentativeSurroundings | null; activeDimension: PreviewDimensionAxis | null }) {
  const svg = useRef<SVGSVGElement>(null);
  const [available, setAvailable] = useState({ width: 600, height: 400 });
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setAvailable({
        width: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        height: element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const { minX, minY, maxX, maxY, lengthMm, projectionMm } = plan.extents;
  const compact = available.width < 600;
  // Fit the actual pergola, with fixed pixel gutters for annotations. The patio
  // stays as context but must not shrink the drawing or move its dimension lines.
  const padding = compact ? { left: 10, right: 38, top: 22, bottom: 40 } : { left: 18, right: 52, top: 32, bottom: 64 };
  const scale = Math.max(.001, Math.min(
    Math.max(1, available.width - padding.left - padding.right) / lengthMm,
    Math.max(1, available.height - padding.top - padding.bottom) / projectionMm,
  ));
  const left = minX - padding.left / scale, right = maxX + padding.right / scale;
  const top = minY - padding.top / scale, bottom = maxY + padding.bottom / scale;
  const widthLine = maxY + (compact ? 27 : 42) / scale;
  const font = 12 / scale;
  const polygons = (points: { x: number; y: number }[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
  const members = [...plan.members.rafters, ...plan.members.beams, ...plan.members.ledgers, ...plan.members.gutters, ...plan.members.joiners, ...plan.members.ridge];
  const projectionLine = maxX + (compact ? 23 : 30) / scale;
  return <svg ref={svg} className={styles.plan} role="img" aria-label={`Pergola plan, ${metres(lengthMm)} wide by ${metres(projectionMm)} projection`}
    viewBox={`${left} ${top} ${right - left} ${bottom - top}`}>
    {context && <g data-context="plan-surroundings">
      <rect x={context.patio.min.x} y={context.patio.min.y} width={context.patio.max.x - context.patio.min.x}
        height={context.patio.max.y - context.patio.min.y} fill="#eeece5" stroke="#c4c6bb" strokeWidth={.7} vectorEffect="non-scaling-stroke" />
      <rect x={context.wall.min.x} y={top} width={context.wall.max.x - context.wall.min.x}
        height={Math.max(0, context.wall.max.y - top)} fill="#d9dcd2" />
      <line x1={context.wall.min.x} x2={context.wall.max.x} y1={context.wall.max.y} y2={context.wall.max.y} stroke="#959c8c" strokeWidth={12} />
      <rect x={context.architecture.opening.min.x} y={context.wall.max.y - 75}
        width={context.architecture.opening.max.x - context.architecture.opening.min.x} height={100} fill="#becbc2" stroke="#7c8578" strokeWidth={8} />
      <line x1={(context.architecture.opening.min.x + context.architecture.opening.max.x) / 2}
        x2={(context.architecture.opening.min.x + context.architecture.opening.max.x) / 2} y1={context.wall.max.y - 75} y2={context.wall.max.y + 25} stroke="#7c8578" strokeWidth={8} />
      {context.architecture.steps.map(step => <rect key={step.id} x={step.min.x} y={step.min.y}
        width={step.max.x - step.min.x} height={step.max.y - step.min.y} fill="#eeece5" stroke="#a5aa9e" strokeWidth={8} />)}
      {context.brackets.map(bracket => <rect key={bracket.id} data-bracket-id={bracket.id}
        x={bracket.startX} y={Math.min(...bracket.section.map(point => point.y))}
        width={bracket.endX - bracket.startX}
        height={Math.max(...bracket.section.map(point => point.y)) - Math.min(...bracket.section.map(point => point.y))}
        fill="#4c514a" />)}
    </g>}
    <polygon points={polygons(plan.outline)} fill="#e7ece5" stroke="#a6afa1" strokeWidth={.8} vectorEffect="non-scaling-stroke" />
    {members.map((member) => <line key={member.id} data-member-id={member.id}
      x1={member.centerline.start.x} y1={member.centerline.start.y} x2={member.centerline.end.x} y2={member.centerline.end.y}
      stroke={plan.members.rafters.includes(member) ? '#858e7f' : '#4c5546'} strokeWidth={member.profile.widthMm} />)}
    {flashings.filter(flashing => flashing.metadata?.representativeGableRidge).map(flashing => <g key={flashing.id} data-ridge-flashing={flashing.metadata?.wingLengthMm}>
      {flashing.wings.map(wing => <polygon key={wing.id} points={polygons(wing.boundary)} fill="#586150" stroke="#343d2e" strokeWidth={.6} vectorEffect="non-scaling-stroke" />)}
    </g>)}
    {plan.members.posts.map((member) => {
      const width = Number(member.metadata?.footprintWidthMm ?? member.profile.widthMm);
      const height = Number(member.metadata?.footprintProjectionMm ?? member.profile.widthMm);
      return <rect key={member.id} data-member-id={member.id}
        x={member.centerline.start.x - width / 2} y={member.centerline.start.y - height / 2}
        width={width} height={height} fill="#252b25" />;
    })}
    <g fill="none" stroke="#aeb6a5" strokeWidth={.6} vectorEffect="non-scaling-stroke">
      <path vectorEffect="non-scaling-stroke" d={`M ${minX} ${maxY + 4 / scale} V ${widthLine + font * .5} M ${maxX} ${maxY + 4 / scale} V ${widthLine + font * .5}`} />
      <path vectorEffect="non-scaling-stroke" d={`M ${maxX + 4 / scale} ${minY} H ${projectionLine + font * .5} M ${maxX + 4 / scale} ${maxY} H ${projectionLine + font * .5}`} />
    </g>
    <g fill="#6d7763" fontFamily="Inter, sans-serif" fontSize={9 / scale} letterSpacing={.65 / scale}>
      <text x={(minX + maxX) / 2} y={minY - 8 / scale} textAnchor="middle">HOUSE CONNECTION</text>
      <text x={minX} y={maxY + 12 / scale}>FRONT EDGE</text>
    </g>
    <PlanDimension axis="width" value={lengthMm} active={activeDimension === 'width'} start={minX} end={maxX} offset={widthLine} scale={scale} compact={compact} />
    <PlanDimension axis="projection" value={projectionMm} active={activeDimension === 'projection'} start={minY} end={maxY} offset={projectionLine} scale={scale} compact={compact} />
  </svg>;
}
