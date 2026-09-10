import { usePreviewBlinds } from './PreviewBlindProvider';
import SidePanelPlan from './SidePanelPlan';
export default function BlindPlan({scale}:{scale:number}) {
  const workspace=usePreviewBlinds();
  if(!workspace)return null;
  return <g>{workspace.openings.map(o=>{const panel=workspace.panels.find(p=>p.opening===o.id),blind=workspace.blinds.find(b=>b.opening===o.id)||panel;if(!blind&&!workspace.editing)return null;return <g key={o.id}>
    {panel&&<SidePanelPlan opening={o} panel={panel}/>}
    <line x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke={workspace.editing&&workspace.selected===o.id?'#829461':'#454f42'} strokeWidth={panel?1:blind?5:2} vectorEffect="non-scaling-stroke" strokeDasharray={blind?undefined:'6 4'}/>
    {(workspace.editing||blind)&&<rect role="button" tabIndex={0} aria-label={'Select '+o.label+' opening'} data-blind-opening={o.id} x={Math.min(o.start.x,o.end.x)-12/scale} y={Math.min(o.start.y,o.end.y)-12/scale} width={Math.abs(o.end.x-o.start.x)+24/scale} height={Math.abs(o.end.y-o.start.y)+24/scale} fill="transparent" style={{cursor:'pointer'}} onClick={()=>workspace.select(o.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')workspace.select(o.id);}}/>}
  </g>;})}</g>;
}
