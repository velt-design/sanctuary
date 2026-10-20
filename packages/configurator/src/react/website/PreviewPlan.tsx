
import {hasLighting} from '../../website';
import PreviewPlanProduct from './PreviewPlanProduct';
import {useLighting} from './LightingProvider';
import type { RoofFinishGeometry } from "@sp/geometry";
import { useLayoutEffect, useRef, useState } from 'react';
import type { GeometryPlanViewModel, RepresentativeSurroundings, RoofFlashing3D, RoofPlane3D } from '@sp/geometry';
import { metres } from '../../geometry';
import styles from './PreviewPlan.module.css';
import PlanDimension from './PlanDimension';
import {usePreviewBlinds} from './PreviewBlindProvider';
type PreviewDimensionAxis = 'width' | 'projection';

export default function PreviewPlan({ profile = 'corrugated', trayWidth = 400, roofPlanes = [], covering, plan, flashings = [], context, activeDimension, readOnly = false, preserveTool = false, formatDimension = metres, section = 'structure', className, guidedOpenings = false }: { preserveTool?:boolean; formatDimension?:(mm:number)=>string; section?: string; className?: string; guidedOpenings?: boolean; readOnly?: boolean; profile?: string; trayWidth?: number; roofPlanes?: RoofPlane3D[]; covering?: RoofFinishGeometry; plan: GeometryPlanViewModel; flashings?: RoofFlashing3D[]; context: RepresentativeSurroundings | null; activeDimension: PreviewDimensionAxis | null }) {
  const lighting=useLighting();
  const roofFocus=section==='roof';
  const sides=usePreviewBlinds();
  const lightingPlan=!!lighting?.editing;
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
  // Fit the actual pergola with fixed pixel gutters for annotations.
  // Include the whole centred dimension badge (25 + 19px on the left),
  // bottom badge, and plan title in compact viewports, with breathing room.
  const padding = guidedOpenings ? { left: 76, right: 76, top: context ? 80 : 50, bottom: 68 }
    : compact ? { left: 50, right: 12, top: context && !lightingPlan ? 80 : 50, bottom: 46 } : { left: 100, right: 40, top: context && !lightingPlan ? 138 : 100, bottom: 112 };
  const scale = Math.max(.001, Math.min(
    Math.max(1, available.width - padding.left - padding.right) / lengthMm,
    Math.max(1, available.height - padding.top - padding.bottom) / projectionMm,
  ));
  const left = minX - padding.left / scale, right = maxX + padding.right / scale;
  const top = minY - padding.top / scale, bottom = maxY + padding.bottom / scale;
  const widthLine = maxY + (compact ? 27 : 42) / scale;
  const font = 12 / scale;
  const legend = [
    { label: 'Frame', fill: '#c7cdc1' },
    ...(!covering || covering.regions.some(r => r.material === 'acrylic') ? [{ label: 'Acrylic', fill: 'url(#plan-acrylic)' }] : []),
    ...(covering?.regions.some(r => r.material === 'solid') ? [{ label: lightingPlan ? 'Timber ceiling' : 'Solid roof', fill: lightingPlan ? '#e2ddcc' : '#cdd3c7' }] : []),
    ...(lightingPlan && lighting && hasLighting(lighting.value) ? [{ label: 'Lighting', fill: '#fff1ce' }] : []),
  ];
  const projectionLine = minX - (compact ? 25 : 60) / scale;
  return <svg ref={svg} className={className ?? styles.plan} role="group" preserveAspectRatio="xMidYMid meet" onClick={()=>{const focused=document.activeElement;if(focused instanceof SVGElement && svg.current?.contains(focused))focused.blur();sides?.setEditing(false);if(lightingPlan&&!preserveTool)lighting?.setTool(null);}} aria-label={`Pergola plan, ${formatDimension(lengthMm)} wide by ${formatDimension(projectionMm)} projection`}
    viewBox={`${left} ${top} ${right - left} ${bottom - top}`}>
    <title>{lightingPlan ? 'Reflected ceiling plan: looking up from below' : 'Roof plan: looking down from above'}</title>
    <defs>
      <pattern id="plan-acrylic" width={26/scale} height={26/scale} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={26/scale} height={26/scale} fill="#e5eeeb"/>
        <line x1="0" y1="0" x2="0" y2={26/scale} stroke="#9cafaa" strokeOpacity=".35" strokeWidth={.7/scale}/>
      </pattern>
      <pattern id="plan-grid" width={60/scale} height={60/scale} patternUnits="userSpaceOnUse"><path d={`M ${60/scale} 0 H 0 V ${60/scale}`} fill="none" stroke="#343a33" strokeOpacity=".05" strokeWidth={.6/scale}/></pattern>
      <pattern id="plan-hatch" width={11/scale} height={11/scale} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2={11/scale} stroke="#343a33" strokeOpacity=".2" strokeWidth={1/scale}/></pattern>
    </defs>
    <rect x={left} y={top} width={right-left} height={bottom-top} fill="url(#plan-grid)" />
    <g className={styles.gardenPlan} data-plan-facing-house transform={`translate(${minX + maxX} 0) scale(-1 1)`}>
    {context && !lightingPlan && <g data-context="house-footprint">
      <rect x={minX-(compact ? 10 : 30)/scale} y={minY-(compact ? 54 : 76)/scale} width={lengthMm+(compact ? 20 : 60)/scale} height={(compact ? 54 : 76)/scale} fill="#d9ddd5" stroke="#b9c1b4" strokeWidth={.5/scale}/>
      <rect data-context="house-band" x={minX-(compact ? 10 : 30)/scale} y={minY-14/scale} width={lengthMm+(compact ? 20 : 60)/scale} height={14/scale} fill="url(#plan-hatch)" stroke="#717c6a" strokeWidth={.7/scale}/>
      <text x={(minX+maxX)/2} y={minY-(compact ? 33 : 45)/scale} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={(compact ? 10 : 12)/scale} letterSpacing={1/scale} fill="#5d675c">EXISTING HOUSE</text>
      <line x1={minX} y1={minY} x2={maxX} y2={minY} stroke="#4f5d45" strokeWidth={2/scale}/>
    </g>}
    <PreviewPlanProduct plan={plan} covering={covering} profile={profile} trayWidth={trayWidth} roofPlanes={roofPlanes} flashings={flashings} scale={scale} compact={compact} roofFocus={roofFocus} readOnly={readOnly} guidedOpenings={guidedOpenings}/>
    </g>
    {!guidedOpenings && <g fill="none" stroke="#aeb6a5" strokeWidth={.6} vectorEffect="non-scaling-stroke">
      <path vectorEffect="non-scaling-stroke" d={`M ${minX} ${maxY + 4 / scale} V ${widthLine + font * .5} M ${maxX} ${maxY + 4 / scale} V ${widthLine + font * .5}`} />
      <path vectorEffect="non-scaling-stroke" d={`M ${minX - 4 / scale} ${minY} H ${projectionLine - font * .5} M ${minX - 4 / scale} ${maxY} H ${projectionLine - font * .5}`} />
    </g>}
    <g fill="#5d675c" fontFamily="Inter, sans-serif" fontSize={(compact ? 9 : 12) / scale} letterSpacing={.65 / scale}>
      <text x={minX} y={minY - (context && !lightingPlan ? compact ? 62 : 102 : compact ? 32 : 48) / scale} fill="#2f382f" fontWeight={600} fontSize={(compact ? 10 : 13) / scale}>{lightingPlan ? 'REFLECTED CEILING PLAN' : 'ROOF PLAN'}</text>
      {(!context || lightingPlan) && <text x={(minX + maxX) / 2} y={minY - (lightingPlan ? 8 : 24) / scale} textAnchor="middle">{plan.connectionType==='freestanding'?'REAR EDGE':'HOUSE CONNECTION'}</text>}
      {!guidedOpenings && <text x={minX} y={maxY + 12 / scale}>FRONT EDGE</text>}
    </g>
    {!compact && <g transform={`translate(${minX},${maxY+83/scale})`} fontFamily="Inter, sans-serif" fontSize={12/scale} fill="#5d675c" aria-label="Plan legend">
      {sides?.editing && !lightingPlan ? <>
        <line x1="0" x2={22/scale} y1={-5/scale} y2={-5/scale} stroke="#454f42" strokeDasharray="6 4" strokeWidth={1.5/scale}/><text x={30/scale}>Hover or tap a side</text>
        <line x1={180/scale} x2={202/scale} y1={-5/scale} y2={-5/scale} stroke="#4f5d45" strokeWidth={4/scale}/><text x={210/scale}>Selected opening</text>
      </> : legend.map((item,index) => <g key={item.label} transform={`translate(${index*136/scale},0)`}>
        <rect x="0" y={-12/scale} width={18/scale} height={12/scale} fill={item.fill} stroke="#5d675c" strokeWidth={.8/scale}/>
        <text x={26/scale}>{item.label}</text>
      </g>)}
    </g>}
    {!guidedOpenings && <><PlanDimension formatDimension={formatDimension} axis="width" value={lengthMm} active={activeDimension === 'width'} start={minX} end={maxX} offset={widthLine} scale={scale} compact={compact} />
    <PlanDimension formatDimension={formatDimension} axis="projection" value={projectionMm} active={activeDimension === 'projection'} start={minY} end={maxY} offset={projectionLine} scale={scale} compact={compact} /></>}
  </svg>;
}
