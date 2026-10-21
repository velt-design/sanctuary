'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import { SceneCanvas as Canvas } from '@sp/geometry-viewer/react/canvas';
import {Html,Line} from '@react-three/drei';
import {PreviewProductNode,PreviewPlanProduct,PreviewCamera,PreviewLighting,LightingProvider,PreviewBlindProvider,useLighting,DayNightTransition,StudioTreatment} from '@sp/configurator/react';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {computeSceneBoundsFromPoints} from '@sp/geometry-viewer';
import {SceneObjectNode} from '@sp/geometry-viewer/react';
import {buildHouseModelSceneObjects} from '@sp/geometry';
import {buildWorkbenchProjectModelFromObjectFirstDraft} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {buildProjectHouseGeometryRegistry} from '@/lib/drawings/state/projectHouseGeometryRegistry';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {websiteComposition,transformWebsitePoint,snapWebsiteEdges} from '@/lib/designStudio/websiteComposition';
import {buildHouseSnapTargets} from '@/lib/drawings/state/houseSnapTargets';
import type {WebsiteJoin} from '@/lib/designStudio/websiteJoinIntent';
import {websiteProductPhysical} from '@/lib/designStudio/websiteProductPhysical';
import {joinEdge} from '@/lib/designStudio/websiteJoinGeometry';
import {websiteJoinStates} from '@/lib/designStudio/websiteJoins';
import {websiteHouseTargets} from '@/lib/designStudio/websiteAttachment';
import {studioCompositionOverview} from './studioCompositionOverview';
import css from './StudioWebsite.module.css';
const noop=()=>{};
type Props={edit:StudioAuthoringEdit;previewEdit?:StudioAuthoringEdit|null;joinDraft?:WebsiteJoin|null;onJoinTarget?:(id:string,edge:WebsiteJoin['a']['edge'])=>void;selected:string;section:string;placement:boolean;onSelect:(id:string)=>void;onMove:(id:string,x:number,y:number)=>void;readOnly?:boolean;pickHouseEdge?:boolean;attachmentKind?:'wall'|'roof_eave';onHouseEdge?:(houseId:string,edgeId:string,kind:string)=>void;onDimension:(axis:'width'|'projection')=>void};
export default function StudioWebsiteCompositionScene({edit,previewEdit=null,joinDraft=null,onJoinTarget,selected,section,placement,onSelect,onMove,onDimension,readOnly=false,pickHouseEdge=false,attachmentKind='roof_eave',onHouseEdge}:Props){
 const context=useLighting(),[localView,setLocalView]=useState<'Plan'|'3D'>('3D'),[localNight,setLocalNight]=useState(false);
 const light=context??{view:localView,setView:setLocalView,night:localNight,setNight:setLocalNight};
 const [fit,setFit]=useState(0),[zoom,setZoom]=useState(1),[previewFrame,setPreviewFrame]=useState<{x:number;y:number}[]>([]);
 const joinTargets=useMemo(()=>!joinDraft?[]:websiteComposition(edit).filter(r=>r.object.id!==joinDraft.a.objectId&&!r.error&&r.position).flatMap(r=>{
  try{const physical=websiteProductPhysical(r);return physical.edges.flatMap(edge=>{try{const face=joinEdge(physical,edge.id,r.position!);const n=face.normal,t=face.tangent;return [{id:r.object.id,edge:edge.id,label:`${r.object.label} · ${edge.id}`,start:{x:n.x*face.plane+t.x*face.start,y:n.y*face.plane+t.y*face.start},end:{x:n.x*face.plane+t.x*face.end,y:n.y*face.plane+t.y*face.end}}];}catch{return [];}});}catch{return [];}
 }),[edit,joinDraft]);
 const proposed=useMemo(()=>{if(!previewEdit||!joinDraft)return null;const r=websiteComposition(previewEdit).find(p=>p.object.id===joinDraft.a.objectId);if(!r?.design||!r.position)return null;const g=solvePergolaPreview(r.design.input,r.design.roof,r.geometryOptions).geometry;return g?{label:r.object.label,points:g.plan.outline.map(p=>transformWebsitePoint(p,r.position!))}:null;},[previewEdit,joinDraft]);
 const joinStates=useMemo(()=>websiteJoinStates(edit),[edit]);
 const products=useMemo(()=>websiteComposition(edit).map(row=>({...row,geometry:row.design&&!row.error?solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry:null})),[edit]);
 const houses=useMemo(()=>buildProjectHouseGeometryRegistry(buildWorkbenchProjectModelFromObjectFirstDraft({...edit.spatial,pergolas:[]})),[edit.spatial]);
 const points=useMemo(()=>[...products.flatMap(p=>p.geometry&&p.position?p.geometry.assembly.members.flatMap(m=>[m.centerline.start,m.centerline.end]).map(v=>transformWebsitePoint(v,p.position!)):[]),...houses.flatMap(h=>h.model.wallSegments.flatMap(w=>[w.line.start,w.line.end]))],[products,houses]);
 const bounds=useMemo(()=>computeSceneBoundsFromPoints(points),[points]);
 const overview=useMemo(()=>studioCompositionOverview(products.flatMap(p=>{if(!p.geometry||!p.position)return [];const outline=p.geometry.plan.outline.map(v=>transformWebsitePoint(v,p.position!));return [outline.reduce((sum,v)=>({x:sum.x+v.x/outline.length,y:sum.y+v.y/outline.length}),{x:0,y:0})];}),houses.flatMap(h=>h.model.footprint)),[products,houses]);
 const night=useRef({current:0,listeners:new Set<()=>void>()});useEffect(()=>{night.current.current=light.night?1:0;night.current.listeners.forEach(f=>f());},[light.night]);
 const drag=useRef<{id:string;x:number;y:number;worldX:number;worldY:number}|null>(null),svg=useRef<SVGSVGElement>(null);
 const [moving,setMoving]=useState<{id:string;x:number;y:number}|null>(null),[snapLabel,setSnapLabel]=useState<string|null>(null),[committedSnap,setCommittedSnap]=useState<{id:string;x:number;y:number;label:string}|null>(null);
 const framePoints=[...points,...previewFrame];
 const xValues=framePoints.map(p=>p.x),yValues=framePoints.map(p=>p.y);
 const minX=Math.min(0,...xValues),minY=Math.min(0,...yValues),maxX=Math.max(6000,...xValues),maxY=Math.max(3000,...yValues);
 const width=(maxX-minX+2200)/zoom,height=(maxY-minY+2200)/zoom,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const coordinate=(x:number,y:number)=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return null;return new DOMPoint(x,y).matrixTransform(matrix.inverse());};
 function up(){if(moving){if(snapLabel)setCommittedSnap({...moving,label:snapLabel});onMove(moving.id,moving.x,moving.y);}drag.current=null;setMoving(null);setSnapLabel(null);}
 function dragMove(clientX:number,clientY:number){
  const d=drag.current,p=coordinate(clientX,clientY);if(!d||!p)return;
  const movingHouse=edit.spatial.houseAssembly?.houseForms.find(h=>h.id===d.id);if(movingHouse){setSnapLabel(null);setMoving({id:d.id,x:Math.round(d.x+p.x-d.worldX),y:Math.round(d.y+p.y-d.worldY)});return;}
  const movingProduct=products.find(row=>row.object.id===d.id);if(!movingProduct?.geometry||!movingProduct.position)return;
  const position={x:Math.round(d.x+p.x-d.worldX),y:Math.round(d.y+p.y-d.worldY),rotation:movingProduct.position.rotation};
  const outline=movingProduct.geometry.plan.outline.map(point=>transformWebsitePoint(point,position));
  const targets=[...houses.flatMap(h=>buildHouseSnapTargets({houseModel:h.model,houseObjectId:h.houseFormId}).map(t=>({...t,label:`House ${t.edgeKind==='wall'?'wall':'roof edge'}`}))),...products.filter(row=>row.object.id!==d.id&&row.geometry&&row.position).flatMap(row=>{const pts=row.geometry!.plan.outline.map(point=>transformWebsitePoint(point,row.position!));return pts.map((point,index)=>({id:JSON.stringify([row.object.id,index]),label:`${row.object.label} edge ${index+1}`,start:point,end:pts[(index+1)%pts.length]}));})];
  const snap=snapWebsiteEdges(outline,targets);setSnapLabel(snap?.label??null);setMoving({id:d.id,x:Math.round(position.x+(snap?.dx??0)),y:Math.round(position.y+(snap?.dy??0))});
 }
 return <div className={`${css.canvas} ${css.compositionCanvas}`}>
 <div style={{position:'absolute',inset:0,visibility:light.view==='Plan'?'hidden':'visible'}} aria-hidden={light.view==='Plan'}>
 <Canvas shadows="percentage" frameloop="demand" dpr={[1,1.5]} camera={{position:[12000,18000,12000],up:[0,0,1],fov:24,near:10,far:200000}} aria-label="Whole design 3D model">
 <DayNightTransition presentation={night.current}><StudioTreatment.Provider value={true}>
 <PreviewLighting reducedDetail={false} studio review={false}/>
 <PreviewCamera overviewDirection={overview} fitPadding={.84} framingKey={edit.designId} studio bounds={bounds} fitPoints={points} enabled={light.view==='3D'} reset={0} fit={fit} surroundings={houses.length>0}/>
 <mesh receiveShadow position={[cx,cy,-5]}><planeGeometry args={[100000,100000]}/><meshStandardMaterial color="#d9d3c7" roughness={1}/></mesh>
 {products.map(p=>p.geometry&&p.position&&p.design?<Passive key={p.object.id} row={p} selected={selected===p.object.id} night={light.night}>
 <group position={[p.position.x,p.position.y,0]} rotation={[0,0,p.position.rotation*Math.PI/180]} onClick={e=>{e.stopPropagation();onSelect(p.object.id);}}>
 <PreviewProductNode scene={p.geometry.viewerScene} covering={p.geometry.covering} selected={selected===p.object.id} choiceView={selected===p.object.id?(section==='Sides'?'sides':section==='Lighting'?'lighting':undefined):undefined}/>
 {selected===p.object.id&&!readOnly&&<Line points={[...p.geometry.plan.outline,p.geometry.plan.outline[0]].map(v=>[v.x,v.y,20] as [number,number,number])} color="#826344" lineWidth={2}/>}
 {(readOnly||selected===p.object.id)&&<Html center position={[(p.geometry.plan.extents.minX+p.geometry.plan.extents.maxX)/2,(p.geometry.plan.extents.minY+p.geometry.plan.extents.maxY)/2,Math.max(...p.geometry.assembly.members.flatMap(m=>[m.centerline.start.z,m.centerline.end.z]))+250]} style={{pointerEvents:'none'}}><span className={css.selectedObjectLabel}>{p.object.label}</span></Html>}
 {selected===p.object.id&&<mesh position={[(p.geometry.plan.extents.minX+p.geometry.plan.extents.maxX)/2,(p.geometry.plan.extents.minY+p.geometry.plan.extents.maxY)/2,2]}><planeGeometry args={[p.geometry.plan.extents.lengthMm+120,p.geometry.plan.extents.projectionMm+120]}/><meshBasicMaterial color="#826344" transparent opacity={.12} depthWrite={false}/></mesh>}
 </group></Passive>:null)}
 {joinStates.filter(s=>s.witness).map(s=>{const w=s.witness!,n=w.normal,t={x:-n.y,y:n.x},points=w.contact.map(p=>[n.x*w.plane+t.x*p.x,n.y*w.plane+t.y*p.x,p.y] as [number,number,number]);return <Line key={s.join.id} points={[...points,points[0]]} color="#826344" lineWidth={3}/>;})}
 {houses.map(h=><group key={h.houseFormId} onClick={e=>{e.stopPropagation();onSelect(h.houseFormId);}}>{buildHouseModelSceneObjects({model:h.model,attachmentTarget:null}).map(object=><SceneObjectNode key={object.id} object={object} color="#c8c4ba" selected={selected===h.houseFormId} hovered={false} onSelect={()=>onSelect(h.houseFormId)} onHoverEnter={noop} onHoverLeave={noop} onFocus={noop} clippingPlanes={[]}/>)}</group>)}
 </StudioTreatment.Provider></DayNightTransition></Canvas></div>
 {light.view==='Plan'&&<svg ref={svg} className={css.compositionPlan} viewBox={`${cx-width/2} ${cy-height/2} ${width} ${height}`} aria-label="Whole design Plan" onPointerMove={e=>dragMove(e.clientX,e.clientY)} onPointerUp={up} onPointerCancel={()=>{drag.current=null;setMoving(null);}}>
 {houses.map(h=>{const form=edit.spatial.houseAssembly!.houseForms.find(f=>f.id===h.houseFormId)!,x=Number(form.position?.originXMm??form.transform.offsetXM*1000),y=Number(form.position?.originYMm??form.transform.offsetYM*1000),offset=moving?.id===h.houseFormId?{x:moving.x-x,y:moving.y-y}:{x:0,y:0};const centre=h.model.footprint.reduce((c,p)=>({x:c.x+p.x/h.model.footprint.length,y:c.y+p.y/h.model.footprint.length}),{x:0,y:0});const angle=Number(form.position?.rotationDeg??form.transform.rotationQuarterTurns*90)*Math.PI/180;const direction=form.roofIntent.primaryFallDirection,local=direction==='negative_x'?{x:-1,y:0}:direction==='positive_x'?{x:1,y:0}:direction==='positive_y'?{x:0,y:1}:{x:0,y:-1},v={x:(local.x*Math.cos(angle)-local.y*Math.sin(angle))*550,y:(local.x*Math.sin(angle)+local.y*Math.cos(angle))*550};return <g key={h.houseFormId} transform={`translate(${offset.x} ${offset.y})`}>
 <polygon points={h.model.footprint.map(p=>`${p.x},${p.y}`).join(' ')} fill="#d2cec4" stroke={selected===h.houseFormId?'#826344':'#77776e'} strokeWidth={selected===h.houseFormId?20:8} role="button" tabIndex={0} aria-label={`Select ${form.label}`} onClick={()=>onSelect(h.houseFormId)} onKeyDown={e=>{if(e.key==='Enter')onSelect(h.houseFormId);}} onPointerDown={e=>{if(readOnly||joinDraft||pickHouseEdge)return;onSelect(h.houseFormId);const at=coordinate(e.clientX,e.clientY);if(!at)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:h.houseFormId,x,y,worldX:at.x,worldY:at.y};}}/>
 {form.roofIntent.form==='mono'&&<g pointerEvents="none" aria-label={`${form.label} roof fall`}><line x1={centre.x-v.x} y1={centre.y-v.y} x2={centre.x+v.x} y2={centre.y+v.y} stroke="#555" strokeWidth={12}/><path d={`M${centre.x+v.x-v.x*.25+v.y*.15} ${centre.y+v.y-v.y*.25-v.x*.15} L${centre.x+v.x} ${centre.y+v.y} L${centre.x+v.x-v.x*.25-v.y*.15} ${centre.y+v.y-v.y*.25+v.x*.15}`} fill="none" stroke="#555" strokeWidth={12}/><text x={centre.x+160} y={centre.y} fontSize={140}>House roof fall</text></g>}</g>;})}
 {products.map((p,index)=>{if(!p.geometry||!p.position||!p.design)return null;const position=moving?.id===p.object.id?moving:p.position;return <Passive key={p.object.id} row={p} selected={selected===p.object.id} night={false}><g transform={`translate(${position.x} ${position.y}) rotate(${p.position.rotation})`} role="button" tabIndex={0} aria-label={`Select ${p.object.label}`} onClick={()=>onSelect(p.object.id)} onKeyDown={e=>{if(e.key==='Enter')onSelect(p.object.id);}} onPointerDown={e=>{setCommittedSnap(null);onSelect(p.object.id);if(!placement||p.object.attachment?.host)return;const at=coordinate(e.clientX,e.clientY);if(!at)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:p.object.id,x:p.position!.x,y:p.position!.y,worldX:at.x,worldY:at.y};}}>
 <PreviewPlanProduct plan={p.geometry.plan} covering={p.geometry.covering} roofPlanes={p.geometry.assembly.roofPlanes} flashings={p.geometry.assembly.roofFlashings} profile={p.design.roof.finish?.profile} trayWidth={p.design.roof.finish?.trayWidth} scale={.065*zoom} idPrefix={`object-${index}`} inlineDefs readOnly={placement||selected!==p.object.id}/>
 <polygon points={p.geometry.plan.outline.map(v=>`${v.x},${v.y}`).join(' ')} fill="none" stroke={selected===p.object.id?'#826344':'#787e74'} strokeWidth={selected===p.object.id?24:6} pointerEvents="none"/>
 <text x={p.geometry.plan.extents.minX} y={p.geometry.plan.extents.maxY+300} fontSize={170} fill="#333b34">{p.object.label} · {p.design.input.widthMm/1000} × {p.design.input.projectionMm/1000} m</text>
 </g></Passive>;})}
 {joinStates.filter(s=>s.witness).map(s=>{const w=s.witness!,n=w.normal,t={x:-n.y,y:n.x},along=w.contact.map(p=>p.x),a=Math.min(...along),b=Math.max(...along);return <line key={s.join.id} x1={n.x*w.plane+t.x*a} y1={n.y*w.plane+t.y*a} x2={n.x*w.plane+t.x*b} y2={n.y*w.plane+t.y*b} stroke="#826344" strokeWidth={45}><title>{s.label}</title></line>;})}
 {joinTargets.map(t=><JoinPlanTarget key={JSON.stringify([t.id,t.edge])} target={t} onChoose={()=>onJoinTarget?.(t.id,t.edge)}/>)}
 {proposed&&<g pointerEvents="none"><polygon points={proposed.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="#8c9d81" fillOpacity={.22} stroke="#506743" strokeWidth={35} strokeDasharray="90 45"/><text x={proposed.points[0].x} y={proposed.points[0].y-160} fontSize={130}>Proposed {proposed.label}</text></g>}
 {pickHouseEdge&&websiteHouseTargets(edit.spatial).filter(t=>!t.error&&t.edgeKind===attachmentKind).map(t=><g key={JSON.stringify([t.sourceObjectId,t.id])} role="button" tabIndex={0} aria-label={`Attach to ${t.label}`} onClick={e=>{e.stopPropagation();onHouseEdge?.(t.sourceObjectId!,t.id,t.edgeKind!);}} onKeyDown={e=>{if(e.key==='Enter')onHouseEdge?.(t.sourceObjectId!,t.id,t.edgeKind!);}}><line x1={t.start.x} y1={t.start.y} x2={t.end.x} y2={t.end.y} stroke="#826344" strokeWidth={70}/><text x={(t.start.x+t.end.x)/2} y={(t.start.y+t.end.y)/2-100} fontSize={140}>{t.label}</text></g>)}
 </svg>}
 <div className={css.viewTools}>{(['3D','Plan'] as const).map(mode=><button key={mode} aria-pressed={light.view===mode} onClick={()=>light.setView(mode)}>{mode}</button>)}<button onClick={()=>{setFit(n=>n+1);setZoom(1);setPreviewFrame(proposed?.points??[]);}}>{proposed?'Fit join preview':'Fit whole design'}</button>{light.view==='Plan'?<><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(3,z*1.2))}>+</button><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.4,z/1.2))}>−</button></>:<button onClick={()=>light.setNight(!light.night)}>{light.night?'Day':'Night'}</button>}</div>
 {joinDraft&&<p className={css.snapNotice}>Join preview · original position remains until Join</p>}
 {!joinDraft&&joinStates.length>0&&<div className={css.joinLegend}>{joinStates.map(s=><span key={s.join.id}>{s.error?'Check join: ':'Joined: '}{s.label}</span>)}</div>}
 {snapLabel?<p className={css.snapNotice} role="status">Snap to {snapLabel}</p>:committedSnap&&selected===committedSnap.id&&products.some(p=>p.object.id===committedSnap.id&&p.position?.x===committedSnap.x&&p.position?.y===committedSnap.y)?<p className={css.snapNotice} role="status">Snapped to {committedSnap.label}</p>:null}
 {!readOnly&&products.some(p=>p.object.id===selected)&&<div className={css.dimensionTools}><button onClick={()=>onDimension('width')}>Edit selected width</button><button onClick={()=>onDimension('projection')}>Edit selected projection</button></div>}
 {products.some(p=>p.error)&&<div className={css.compositionIssues} role="alert">{products.filter(p=>p.error).map(p=><button key={p.object.id} onClick={()=>onSelect(p.object.id)}>{p.object.label}: {p.error}</button>)}</div>}
 </div>;
}
/** Painted edge and label share a forgiving hit area without changing geometry. */
export function JoinPlanTarget({target,onChoose}:{target:{label:string;start:{x:number;y:number};end:{x:number;y:number}};onChoose:()=>void}){
 const x=(target.start.x+target.end.x)/2,y=(target.start.y+target.end.y)/2;
 return <g role="button" tabIndex={0} aria-label={`Join target ${target.label}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChoose();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onChoose();}}}>
  <line x1={target.start.x} y1={target.start.y} x2={target.end.x} y2={target.end.y} stroke="transparent" strokeWidth={24} vectorEffect="non-scaling-stroke" pointerEvents="stroke"/>
  <rect x={x} y={y-250} width={Math.max(260,target.label.length*80)} height={280} fill="transparent" pointerEvents="all"/>
  <line x1={target.start.x} y1={target.start.y} x2={target.end.x} y2={target.end.y} stroke="#826344" strokeWidth={60} pointerEvents="none"/>
  <text x={x} y={y-110} fontSize={130} pointerEvents="none">{target.label}</text>
 </g>;
}
function Passive({row,selected,night,children}:{row:ReturnType<typeof websiteComposition>[number];selected:boolean;night:boolean;children:ReactNode}){
 if(selected||!row.design)return children;
 return <LightingProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} onChange={noop}><PreviewBlindProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} onChange={noop} readOnly><Night value={night}/>{children}</PreviewBlindProvider></LightingProvider>;
}
function Night({value}:{value:boolean}){const light=useLighting()!;useEffect(()=>light.setNight(value),[value]);return null;}
