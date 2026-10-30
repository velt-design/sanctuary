import { usePreviewBlinds } from './PreviewBlindProvider';
import SidePanelPlan from './SidePanelPlan';
import styles from './PlanOpening.module.css';

export default function BlindPlan({scale,contextOnly=false, guided=false,selectedIds,onToggle}:{scale:number;contextOnly?:boolean;guided?:boolean;selectedIds?:string[];onToggle?:(id:string)=>void}) {
  const workspace=usePreviewBlinds();
  if(!workspace)return null;
  const centreX=workspace.openings.reduce((sum,o)=>sum+o.start.x+o.end.x,0)/Math.max(1,workspace.openings.length*2);
  const front = workspace.openings.filter(o => o.side === 'front');
  const frontMin = Math.min(...front.flatMap(o => [o.start.x, o.end.x]));
  const frontMax = Math.max(...front.flatMap(o => [o.start.x, o.end.x]));
  return <g>{workspace.openings.map(o=>{
    const panel=workspace.panels.find(p=>p.opening===o.id);
    const blind=workspace.blinds.find(b=>b.opening===o.id);
    if(contextOnly)return panel||blind?<line key={o.id} x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#91998e" strokeOpacity={.4} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none"/>:null;
    const selected=selectedIds?selectedIds.includes(o.id):workspace.editing&&workspace.selected===o.id;
    const vertical=Math.abs(o.end.y-o.start.y)>Math.abs(o.end.x-o.start.x);
    const middleX=(o.start.x+o.end.x)/2, middleY=(o.start.y+o.end.y)/2;
    const x=guided && o.side === 'front' ? (frontMin+frontMax)/2 + (front.indexOf(o)-(front.length-1)/2)*Math.max((frontMax-frontMin)*scale/front.length,64)/scale
      : middleX+(vertical?(o.start.x<centreX?(guided?-38:38):(guided?38:-38))/scale:0);
    const y=middleY+(vertical?0:(guided?38:-23)/scale);
    return <g key={o.id} className={styles.opening} data-selected={selected} data-guided={guided || undefined}
      role="button" tabIndex={0} aria-label={'Select '+o.label+' opening'} aria-pressed={selected} data-blind-opening={o.id}
      onClick={e=>{e.stopPropagation();(onToggle??workspace.select)(o.id);}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();(onToggle??workspace.select)(o.id);}if(e.key==='Escape'){workspace.setEditing(false);e.currentTarget.blur();}}}>
      {panel&&<SidePanelPlan opening={o} panel={panel}/>}
      {blind&&<line x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#657566" strokeWidth={4} vectorEffect="non-scaling-stroke"/>}
      <line className={styles.highlight} x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#4f5d45" strokeWidth={selected?5:3} vectorEffect="non-scaling-stroke"/>
      <rect x={Math.min(o.start.x,o.end.x)-12/scale} y={Math.min(o.start.y,o.end.y)-12/scale} width={Math.abs(o.end.x-o.start.x)+24/scale} height={Math.abs(o.end.y-o.start.y)+24/scale} fill="transparent"/>
      {guided && <line x1={middleX} y1={middleY} x2={x} y2={y} stroke="#4f5d45" strokeWidth={1/scale} pointerEvents="none" />}
      <g className={styles.label} transform={`translate(${x},${y})`}>
        <rect x={-30/scale} y={-(guided?26:12)/scale} width={60/scale} height={(guided?52:24)/scale} rx={2/scale} fill={selected?'#4f5d45':'#f3f4ef'} stroke="#4f5d45" strokeWidth={1/scale}/>
        <text textAnchor="middle" dominantBaseline="central" fontFamily="Inter, sans-serif" fontSize={11/scale} fontWeight={selected?600:400} fill={selected?'#fff':'#384332'}>{o.label}</text>
      </g>
    </g>;
  })}</g>;
}
