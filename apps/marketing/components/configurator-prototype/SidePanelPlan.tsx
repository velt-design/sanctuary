import type {BlindOpening} from '@sp/geometry';
import type {SidePanel} from './sidePanelCatalog';
import {sidePanelSupports} from './sidePanelLayout';
export default function SidePanelPlan({opening:o,panel:p}:{opening:BlindOpening;panel:SidePanel}){
  const u={x:(o.end.x-o.start.x)/o.width,y:(o.end.y-o.start.y)/o.width},n={x:-u.y,y:u.x};
  const point=(x:number,y:number)=>`${o.start.x+u.x*x+n.x*y},${o.start.y+u.y*x+n.y*y}`;
  return <g pointerEvents="none"><polygon points={[point(0,-25),point(o.width,-25),point(o.width,25),point(0,25)].join(' ')} fill={p.kind==='timber'||p.battens?'#aa7950':p.kind==='acrylic'?'#b5d1cd':'#454f42'}/>{sidePanelSupports(o,p).map(x=><polygon key={x} points={[point(Math.max(0,x-25),-30),point(Math.min(o.width,x+25),-30),point(Math.min(o.width,x+25),30),point(Math.max(0,x-25),30)].join(' ')} fill="#242824"/>)}</g>;
}
