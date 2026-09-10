import {layoutLights} from '@sp/geometry';
import {useLighting} from './LightingProvider';
export default function PlanLighting(){
 const w=useLighting();if(!w)return null;
 const lights=[...layoutLights(w.sites.rafters,w.value.rafterCount,w.value.rafterLayout),...layoutLights(w.sites.cedar,w.value.cedarCount,w.value.cedarLayout)];
 return <g data-plan-lighting>{w.sites.strips.filter(s=>w.value.strips.includes(s.id)).map(s=><line key={s.id} x1={s.start.x} y1={s.start.y} x2={s.end.x} y2={s.end.y} stroke="#b78843" strokeWidth={16}/>)}{lights.map(s=><circle key={s.id} cx={s.point.x} cy={s.point.y} r={s.diameter/2} fill="#fff1ce" stroke="#906832" strokeWidth={8}/>)}</g>;
}
