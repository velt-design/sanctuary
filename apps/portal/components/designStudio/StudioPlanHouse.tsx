'use client';
import {useId,useMemo} from 'react';
import type {PointerEvent} from 'react';
import type {ResolvedStudioScene} from '@/lib/designStudio/interaction/resolvedScene';
import {studioHousePlanPresentation} from './studioHousePlanPresentation';
import css from './StudioPlanHouse.module.css';

/** House context only. The same actual footprint remains the sole hit surface;
 * decorative roof faces/lines cannot intercept an object or attachment target. */
export default function StudioPlanHouse({geometry,selected,unitsPerPixel,onSelect,onStartDrag}:{
  geometry:ResolvedStudioScene['houses'][number];selected:boolean;unitsPerPixel:number;
  onSelect:(id:string)=>void;onStartDrag:(event:PointerEvent<SVGElement>,id:string)=>void;
}){
  const id=useId().replace(/:/g,''),g=geometry;
  const presentation=useMemo(()=>studioHousePlanPresentation(g.roof,unitsPerPixel),[g.roof,unitsPerPixel]);
  return <g data-studio-plan-house={g.house.id}>
    <g pointerEvents="none" aria-hidden="true">
      <defs>{presentation.faces.map((face,i)=>face.angle===null?null:<pattern key={i} id={`${id}-slope-${i}`} width={presentation.spacing} height={presentation.spacing} patternUnits="userSpaceOnUse" patternTransform={`rotate(${face.angle})`}>
        <line x1="0" y1="0" x2="0" y2={presentation.spacing} className={css.slope} style={{strokeWidth:.65*presentation.units}}/>
      </pattern>)}</defs>
      {presentation.faces.map((face,i)=><g key={i}>
        <polygon points={face.boundary.map(p=>`${p.x},${p.y}`).join(' ')} className={css.roof}/>
        {face.angle!==null&&<polygon data-house-roof-lines points={face.boundary.map(p=>`${p.x},${p.y}`).join(' ')} fill={`url(#${id}-slope-${i})`}/>}
      </g>)}
      <path d={presentation.outline} className={css.edges} vectorEffect="non-scaling-stroke"/>
    </g>
    <polygon points={g.footprint.map(p=>`${p.x},${p.y}`).join(' ')} className={css.wall} vectorEffect="non-scaling-stroke"
      role="button" tabIndex={0} aria-label={`Select ${g.house.label}`} aria-pressed={selected}
      onClick={()=>onSelect(g.house.id)} onKeyDown={event=>{if(event.key==='Enter')onSelect(g.house.id);}}
      onPointerDown={event=>{if(event.button!==0)return;onSelect(g.house.id);onStartDrag(event,g.house.id);}}/>
  </g>;
}
