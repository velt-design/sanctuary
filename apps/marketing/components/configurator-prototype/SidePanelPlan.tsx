import type {BlindOpening} from '@sp/geometry';
import type {SidePanel} from './sidePanelCatalog';
import {sidePanelSupports} from './sidePanelLayout';
export default function SidePanelPlan({opening:o,panel:p}:{opening:BlindOpening;panel:SidePanel}){
  const u={x:(o.end.x-o.start.x)/o.width,y:(o.end.y-o.start.y)/o.width},n={x:-u.y,y:u.x};
  const point=(x:number,y:number)=>`${o.start.x+u.x*x+n.x*y},${o.start.y+u.y*x+n.y*y}`;
  const vertical=p.kind!=='acrylic'&&p.direction==='vertical',face=Number(p.profile.split('x')[p.edge?1:0]);
  const count=Math.max(1,Math.floor((o.width-6+p.gap)/(face+p.gap))),offset=(o.width-(count*face+(count-1)*p.gap))/2;
  const strips=vertical?Array.from({length:count},(_,i)=>[offset+i*(face+p.gap),offset+i*(face+p.gap)+face]):[[0,o.width]];
  return <g pointerEvents="none">{strips.map(([a,b])=><polygon key={a} points={[point(a,-25),point(b,-25),point(b,25),point(a,25)].join(' ')} fill={p.kind==='timber'||p.battens?'#aa7950':p.kind==='acrylic'?'#b5d1cd':'#454f42'}/>)}{(vertical?[0,o.width]:sidePanelSupports(o,p)).map(x=><polygon key={x} points={[point(Math.max(0,x-25),-30),point(Math.min(o.width,x+25),-30),point(Math.min(o.width,x+25),30),point(Math.max(0,x-25),30)].join(' ')} fill="#242824"/>)}</g>;
}
