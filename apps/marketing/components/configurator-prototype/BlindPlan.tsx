import { usePreviewBlinds } from './PreviewBlindProvider';
import SidePanelPlan from './SidePanelPlan';
import styles from './PlanOpening.module.css';

export default function BlindPlan({scale,contextOnly=false}:{scale:number;contextOnly?:boolean}) {
  const workspace=usePreviewBlinds();
  if(!workspace)return null;
  const centreX=workspace.openings.reduce((sum,o)=>sum+o.start.x+o.end.x,0)/Math.max(1,workspace.openings.length*2);
  return <g>{workspace.openings.map(o=>{
    const panel=workspace.panels.find(p=>p.opening===o.id);
    const blind=workspace.blinds.find(b=>b.opening===o.id);
    if(contextOnly)return panel||blind?<line key={o.id} x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#91998e" strokeOpacity={.4} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none"/>:null;
    const selected=workspace.editing&&workspace.selected===o.id;
    const vertical=Math.abs(o.end.y-o.start.y)>Math.abs(o.end.x-o.start.x);
    const x=(o.start.x+o.end.x)/2+(vertical?(o.start.x<centreX?38:-38)/scale:0);
    const y=(o.start.y+o.end.y)/2-(vertical?0:23/scale);
    return <g key={o.id} className={styles.opening} data-selected={selected}
      role="button" tabIndex={0} aria-label={'Select '+o.label+' opening'} aria-pressed={selected} data-blind-opening={o.id}
      onClick={e=>{e.stopPropagation();workspace.select(o.id);}}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();workspace.select(o.id);}if(e.key==='Escape'){workspace.setEditing(false);e.currentTarget.blur();}}}>
      {panel&&<SidePanelPlan opening={o} panel={panel}/>}
      {blind&&<line x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#657566" strokeWidth={4} vectorEffect="non-scaling-stroke"/>}
      <line className={styles.highlight} x1={o.start.x} y1={o.start.y} x2={o.end.x} y2={o.end.y} stroke="#4f5d45" strokeWidth={selected?5:3} vectorEffect="non-scaling-stroke"/>
      <rect x={Math.min(o.start.x,o.end.x)-12/scale} y={Math.min(o.start.y,o.end.y)-12/scale} width={Math.abs(o.end.x-o.start.x)+24/scale} height={Math.abs(o.end.y-o.start.y)+24/scale} fill="transparent"/>
      <g className={styles.label} transform={`translate(${x},${y})`}>
        <rect x={-30/scale} y={-12/scale} width={60/scale} height={24/scale} rx={2/scale} fill={selected?'#4f5d45':'#f3f4ef'} stroke="#4f5d45" strokeWidth={1/scale}/>
        <text textAnchor="middle" dominantBaseline="central" fontFamily="Inter, sans-serif" fontSize={11/scale} fontWeight={selected?600:400} fill={selected?'#fff':'#384332'}>{o.label}</text>
      </g>
    </g>;
  })}</g>;
}
