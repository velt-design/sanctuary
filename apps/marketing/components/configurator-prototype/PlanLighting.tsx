import {layoutRafterLights,layoutCedarLights} from '@sp/geometry';
import {useLighting} from './LightingProvider';
export default function PlanLighting({scale=1}:{scale?:number}){
 const w=useLighting();if(!w)return null;
 const selecting=w.editing&&w.tool==='strip';
 const lights=[...layoutRafterLights(w.sites.rafters,w.value.rafterAmount??'off'),...layoutCedarLights(w.sites.cedar,w.value.cedarCount,w.value.cedarPattern)];
 return <g data-plan-lighting>
 {w.sites.strips.filter(s=>selecting||w.value.strips.includes(s.id)).map(s=>{
  const selected=w.value.strips.includes(s.id);
  return <g key={s.id}>
   <line x1={s.start.x} y1={s.start.y} x2={s.end.x} y2={s.end.y} stroke={selected?'#b78843':'#657566'} strokeWidth={w.editing?(selected?5:2)/scale:16} pointerEvents="none"/>
   {selecting&&<line role="button" tabIndex={0} aria-label={'LED strip: '+s.label} aria-pressed={selected} data-light-member={s.id}
    x1={s.start.x} y1={s.start.y} x2={s.end.x} y2={s.end.y} stroke="transparent" strokeWidth={24/scale} style={{cursor:'pointer'}}
    onClick={()=>w.toggle(s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();w.toggle(s.id);}}}/>}
  </g>;
 })}
 {lights.map(s=><circle key={s.id} cx={s.point.x} cy={s.point.y} r={w.editing?Math.max(s.diameter/2,4/scale):s.diameter/2} fill="#fff1ce" stroke="#906832" strokeWidth={w.editing?1.5/scale:8} pointerEvents="none"/>)}
 </g>;
}
