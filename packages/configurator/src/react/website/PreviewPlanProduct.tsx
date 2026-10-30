import {acrylicAppearance,frameAppearance} from './productAppearance';
import type { GeometryPlanViewModel, RoofFinishGeometry, RoofFlashing3D, RoofPlane3D } from '@sp/geometry';
import {useLighting} from './LightingProvider';
import {usePreviewBlinds} from './PreviewBlindProvider';
import PlanFinishes from './PlanFinishes';
import PlanLighting from './PlanLighting';
import BlindPlan from './BlindPlan';
/** Product geometry only; the caller owns world placement and optional reflection. */
export default function PreviewPlanProduct({plan,covering,profile='corrugated',trayWidth=400,roofPlanes=[],flashings=[],scale,compact=false,roofFocus=false,readOnly=false,guidedOpenings=false,idPrefix='plan',inlineDefs=false,showRoofFallLabel=true}:{plan:GeometryPlanViewModel;covering?:RoofFinishGeometry;profile?:string;trayWidth?:number;roofPlanes?:RoofPlane3D[];flashings?:RoofFlashing3D[];scale:number;compact?:boolean;roofFocus?:boolean;readOnly?:boolean;guidedOpenings?:boolean;idPrefix?:string;inlineDefs?:boolean;showRoofFallLabel?:boolean}){
 const lighting=useLighting(),sides=usePreviewBlinds(),lightingPlan=Boolean(lighting?.editing);
 const polygons=(points:{x:number;y:number}[])=>points.map(p=>`${p.x},${p.y}`).join(' ');
 const members=[...plan.members.rafters,...plan.members.beams,...plan.members.ledgers,...plan.members.gutters,...plan.members.joiners,...plan.members.ridge];
 const primaryIds=new Set([...plan.members.beams,...plan.members.ledgers,...plan.members.gutters,...plan.members.ridge].map(m=>m.id));
 return <>{inlineDefs&&<defs><pattern id={`${idPrefix}-acrylic`} width={26/scale} height={26/scale} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={26/scale} height={26/scale} fill={lighting?.roof.acrylicTint&&lighting.roof.acrylicTint!=='clear'?acrylicAppearance(lighting.roof.acrylicTint,{studio:true}).color:"#e5eeeb"}/><line x1="0" y1="0" x2="0" y2={26/scale} stroke="#9cafaa" strokeOpacity=".35" strokeWidth={.7/scale}/></pattern></defs>}
    <g>
    <polygon points={polygons(plan.outline)} fill={`url(#${idPrefix}-acrylic)`} stroke="#646d69" strokeWidth={.8} vectorEffect="non-scaling-stroke" />
    {members.map((member) => <line key={member.id} data-member-id={member.id}
      x1={member.centerline.start.x} y1={member.centerline.start.y} x2={member.centerline.end.x} y2={member.centerline.end.y}
      stroke={primaryIds.has(member.id) ? "#2f382f" : "#5d675c"} strokeWidth={member.profile.widthMm + (primaryIds.has(member.id) ? 2.4 : 1.2)/scale} />)}
    {members.map(member => <line key={`inside-${member.id}`} x1={member.centerline.start.x} y1={member.centerline.start.y} x2={member.centerline.end.x} y2={member.centerline.end.y} stroke={frameAppearance(lighting?.roof.frameFinish)??"#c7cdc1"} strokeWidth={Math.max(1,member.profile.widthMm-1/scale)} />)}
    <PlanFinishes covering={covering} reflected={lightingPlan} scale={scale} profile={profile} trayWidth={trayWidth} fall={roofPlanes[0]?.fallVector} />
    {lightingPlan && [...plan.members.beams, ...plan.members.ledgers, ...plan.members.gutters, ...plan.members.ridge].map(member =>
      <g key={`exposed-${member.id}`}><line x1={member.centerline.start.x} y1={member.centerline.start.y}
        x2={member.centerline.end.x} y2={member.centerline.end.y} stroke={primaryIds.has(member.id) ? "#2f382f" : "#5d675c"} strokeWidth={member.profile.widthMm + (primaryIds.has(member.id) ? 2.4 : 1.2)/scale} /><line x1={member.centerline.start.x} y1={member.centerline.start.y} x2={member.centerline.end.x} y2={member.centerline.end.y} stroke={frameAppearance(lighting?.roof.frameFinish)??"#c7cdc1"} strokeWidth={Math.max(1,member.profile.widthMm-1/scale)} /></g>)}
    {!lightingPlan && flashings.filter(flashing => flashing.metadata?.representativeGableRidge).map(flashing => <g key={flashing.id} data-ridge-flashing={flashing.metadata?.wingLengthMm}>
      {flashing.wings.map(wing => <polygon key={wing.id} points={polygons(wing.boundary)} fill="#d4d8d0" stroke="#343a33" strokeWidth={.6} vectorEffect="non-scaling-stroke" />)}
    </g>)}
    {plan.members.posts.map((member) => {
      const width = Number(member.metadata?.footprintWidthMm ?? member.profile.widthMm);
      const height = Number(member.metadata?.footprintProjectionMm ?? member.profile.widthMm);
      return <rect key={member.id} data-member-id={member.id}
        x={member.centerline.start.x - width / 2} y={member.centerline.start.y - height / 2}
        width={width} height={height} fill="#aab4a2" stroke="#343a33" strokeWidth={1.4/scale} />;
    })}
    </g>
    {!lightingPlan && !sides?.editing && roofPlanes.map(plane => {
      const length = Math.hypot(plane.fallVector.x,plane.fallVector.y);
      if (!length || !plane.boundary.length) return null;
      let x=plane.boundary.reduce((sum,p)=>sum+p.x,0)/plane.boundary.length;
      let y=plane.boundary.reduce((sum,p)=>sum+p.y,0)/plane.boundary.length;
      const dx=plane.fallVector.x/length,dy=plane.fallVector.y/length;
      // Put the annotation in a rafter bay using existing member positions.
      const nx=-dy,ny=dx,centre=x*nx+y*ny;
      const bounds=plane.boundary.map(p=>p.x*nx+p.y*ny);
      const positions=[...new Set(plan.members.rafters.map(m=>(m.centerline.start.x+m.centerline.end.x)/2*nx+(m.centerline.start.y+m.centerline.end.y)/2*ny))].filter(v=>v>=Math.min(...bounds)&&v<=Math.max(...bounds)).sort((a,b)=>a-b);
      const bays=positions.slice(1).map((v,i)=>(v+positions[i])/2).sort((a,b)=>Math.abs(a-centre)-Math.abs(b-centre));
      if(bays.length){const shift=bays[0]-centre;x+=nx*shift;y+=ny*shift;}
      const half=(compact ? 14 : 22)/scale,tip=6/scale;
      const ex=x+dx*half,ey=y+dy*half;
      return <g key={plane.id} data-roof-fall pointerEvents="none" stroke="#5d675c" strokeWidth={1/scale} fill="none">
        <path d={`M ${x-dx*half} ${y-dy*half} L ${ex} ${ey} M ${ex-dx*tip-dy*tip*.6} ${ey-dy*tip+dx*tip*.6} L ${ex} ${ey} L ${ex-dx*tip+dy*tip*.6} ${ey-dy*tip-dx*tip*.6}`}/>
        {showRoofFallLabel&&<text x={x+10/scale} y={y-8/scale} fill="#5d675c" stroke="#e5eeeb" strokeWidth={3/scale} paintOrder="stroke" fontFamily="Inter, sans-serif" fontSize={(compact ? 9 : 12)/scale}>Roof fall</text>}
      </g>;
    })}
    {!lightingPlan && <BlindPlan scale={scale} contextOnly={roofFocus || readOnly} guided={guidedOpenings} />}
    {lightingPlan && <PlanLighting scale={scale} readOnly={readOnly}/>}
 </>;
}
