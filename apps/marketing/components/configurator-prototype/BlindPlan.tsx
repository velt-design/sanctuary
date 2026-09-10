import { usePreviewBlinds } from './PreviewBlindProvider';
export default function BlindPlan({scale}:{scale:number}) {
  const workspace=usePreviewBlinds();
  if(!workspace)return null;
  return <g>{workspace.openings.map(o=>{const blind=workspace.blinds.find(b=>b.opening===o.id);if(!blind&&!workspace.editing)return null;return <g key={o.id}>
    <line x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke={workspace.editing&&workspace.selected===o.id?'#829461':'#454f42'} strokeWidth={blind?5:2} vectorEffect="non-scaling-stroke" strokeDasharray={blind?undefined:'6 4'}/>
    {workspace.editing&&<rect role="button" tabIndex={0} aria-label={'Select '+o.label+' opening'} data-blind-opening={o.id} x={Math.min(o.start.x,o.end.x)-12/scale} y={Math.min(o.start.y,o.end.y)-12/scale} width={Math.abs(o.end.x-o.start.x)+24/scale} height={Math.abs(o.end.y-o.start.y)+24/scale} fill="transparent" style={{cursor:'pointer'}} onClick={()=>workspace.select(o.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')workspace.select(o.id);}}/>}
  </g>;})}</g>;
}
