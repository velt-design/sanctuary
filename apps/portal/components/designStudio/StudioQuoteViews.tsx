"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';

import { SceneCanvas as Canvas } from '@sp/geometry-viewer/react/canvas';
import { useThree } from '@react-three/fiber';

import {PreviewCamera,PreviewLighting,PreviewProductNode,PreviewPlanProduct,StudioTreatment} from '@sp/configurator/react';

import {solvePergolaPreview} from '@sp/configurator/geometry';

import {computeSceneBoundsFromPoints} from '@sp/geometry-viewer';

import {websiteComposition,transformWebsitePoint} from '@/lib/designStudio/websiteComposition';

import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';

import {solveStudioHouse} from '@/lib/designStudio/studioHouseGeometry';

import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';

import {websiteProductPhysical} from '@/lib/designStudio/websiteProductPhysical';

import {websiteJoinStates} from '@/lib/designStudio/websiteJoins';

import StudioHouseNode from './StudioHouseNode';

import StudioProductContext from './StudioProductContext';

import WebsiteConnectionDetail from './directDemo/WebsiteConnectionDetail';

import {studioDisplayProduct} from '@/lib/designStudio/studioDisplayProduct';
import css from './StudioReview.module.css';
import {studioCompositionOverview} from './studioCompositionOverview';

export type CapturedStudioViews = Array<{kind:'perspective'|'plan';dataUrl:string}>;

function Capture({signal,onReady,onError}:{signal:number;onReady:(data:string)=>void;onError:(error:unknown)=>void}){

 const {gl,scene,camera,invalidate}=useThree();
 const completed=useRef(0);

 useEffect(()=>{if(!signal||completed.current===signal)return;let alive=true;invalidate();const timer=setTimeout(()=>{if(alive){completed.current=signal;try{gl.render(scene,camera);onReady(gl.domElement.toDataURL('image/png'));}catch(error){onError(error);}}},160);return()=>{alive=false;clearTimeout(timer);};},[signal,gl,scene,camera,invalidate,onReady,onError]);

 return null;

}

async function planPng(svg:SVGSVGElement){

 const clone=svg.cloneNode(true) as SVGSVGElement;

 // Embed the computed SVG presentation so PDF bytes do not depend on a CSS URL.

 const originals=[svg,...svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];

 originals.forEach((node,index)=>{const style=getComputedStyle(node);for(const prop of ['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-opacity','font-family','font-size','font-weight','text-anchor','paint-order','opacity']) (copies[index] as SVGElement).style.setProperty(prop,style.getPropertyValue(prop));});

 clone.setAttribute('width','1400');clone.setAttribute('height','900');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');

 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));

 try {const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=900;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Plan capture is unavailable.');ctx.fillStyle='#f6f5f1';ctx.fillRect(0,0,1400,900);ctx.drawImage(image,0,0,1400,900);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}

}

/** Actual shared product/house geometry, separate presentation camera. Captures never alter the editor cameras. */

export default function StudioQuoteViews({edit,onCapture,disabled=false,captureRequest=0,onCaptureError,manualCapture=true,captureOnly=false,documentTarget='quote'}:{edit:StudioAuthoringEdit;onCapture:(images:CapturedStudioViews)=>void;disabled?:boolean;captureRequest?:number;onCaptureError?:(message:string)=>void;manualCapture?:boolean;captureOnly?:boolean;documentTarget?:'quote'|'booklet'}){

 const rows=useMemo(()=>websiteComposition(edit).map(source=>{const row=studioDisplayProduct(source);return {...row,geometry:row.design?solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry:null};}),[edit]);

 const houses=useMemo(()=>studioHouseScene(edit.site,edit.spatial)!.houses.map(solveStudioHouse),[edit]);

 const points=useMemo(()=>[...houses.flatMap(h=>[...h.walls.flat(),...h.roof.flat()]),...rows.flatMap(row=>row.geometry&&row.position?(row.error?row.geometry.assembly.members.flatMap(m=>[m.centerline.start,m.centerline.end]):websiteProductPhysical(row).points).map(p=>transformWebsitePoint(p,row.position!)):[])],[rows,houses]);

 const bounds=useMemo(()=>computeSceneBoundsFromPoints(points),[points]);

 const overview=useMemo(()=>studioCompositionOverview(rows.flatMap(row=>row.position&&row.geometry?[row.geometry.plan.outline.map(p=>transformWebsitePoint(p,row.position!)).reduce((sum,p,_,points)=>({x:sum.x+p.x/points.length,y:sum.y+p.y/points.length}),{x:0,y:0})]:[]),houses.flatMap(h=>h.footprint),30),[rows,houses]);

 const [presentation,setPresentation]=useState<'overall'|'lower'|'opposite'>('overall'),[frame,setFrame]=useState(0);
 const baseDirection=overview??{x:1.45,y:1.9,z:.7};
 const direction={...baseDirection,...(presentation==='lower'?{z:.25}:presentation==='opposite'?{x:-baseDirection.x,y:-baseDirection.y}: {})};
 const plan=useRef<SVGSVGElement>(null),[signal,setSignal]=useState(0),[capturing,setCapturing]=useState(false),[message,setMessage]=useState<string|null>(null),captureTurn=useRef(0);
 function beginCapture(){captureTurn.current++;setCapturing(true);setMessage(null);setSignal(captureTurn.current);}

 const generation=JSON.stringify(edit),active=useRef(generation);active.current=generation;
 useEffect(()=>{active.current=generation;return()=>{active.current='';};},[generation]);
 const fail=useCallback((error:unknown)=>{captureTurn.current++;const message=error instanceof Error?error.message:typeof error==='string'?error:'Capture failed. Retry.';setMessage(message);setCapturing(false);onCaptureError?.(message);},[onCaptureError]);

 const framingPoints=points.length?points:[{x:0,y:0},{x:1,y:1}];
 const minX=Math.min(...framingPoints.map(p=>p.x)),maxX=Math.max(...framingPoints.map(p=>p.x)),minY=Math.min(...framingPoints.map(p=>p.y)),maxY=Math.max(...framingPoints.map(p=>p.y));

 const margin=Math.max(maxX-minX,maxY-minY)*.10+150;

 const joins=websiteJoinStates(edit);

 const ready=useMemo(()=>async(dataUrl:string)=>{const key=generation;try{if(!plan.current)throw Error('Plan capture is unavailable.');const planImage=await planPng(plan.current);if(captureTurn.current!==signal)return;if(!active.current)return;if(active.current!==key)throw Error('Design changed while capturing. Capture the views again.');onCapture([{kind:'perspective',dataUrl},{kind:'plan',dataUrl:planImage}]);setMessage('Both design views captured.');}catch(error){if(active.current&&captureTurn.current===signal)fail(error);}finally{if(active.current&&captureTurn.current===signal)setCapturing(false);}},[generation,onCapture,fail,signal]);
 const requested=useRef(0);
 useEffect(()=>{if(!captureRequest||requested.current===captureRequest)return;requested.current=captureRequest;if(disabled||!points.length||rows.some(r=>r.error)){fail('The current design is not ready to capture. Review its selections and try again.');return;}beginCapture();},[captureRequest,disabled,points.length,rows,fail]);
 useEffect(()=>{if(!capturing)return;const timer=setTimeout(()=>{fail('The design views could not be captured. Please try again.');},15000);return()=>clearTimeout(timer);},[capturing,fail]);

 return <section className={captureOnly?css.captureSurface:undefined} aria-hidden={captureOnly||undefined} inert={captureOnly||undefined}><h2>Design views</h2><p className={css.viewHelp}>Orbit or zoom to show the selected sides and connection. These presentation controls are separate from the editor. {documentTarget==='booklet'?'Capture optional views, then select the ones to include inside the design booklet.':'The quote includes this view and its Plan.'}</p><div className={css.viewActions} role="group" aria-label="Presentation camera">{(['overall','lower','opposite'] as const).map((view,i)=><button key={view} disabled={capturing} aria-pressed={presentation===view} onClick={()=>{setPresentation(view);setFrame(n=>n+1);}}>{['Overall view','Lower view','Opposite side'][i]}</button>)}</div>

 <div className={css.perspective}><Canvas shadows dpr={1.5} frameloop="demand" gl={{preserveDrawingBuffer:true}} camera={{position:[10000,16000,10000],up:[0,0,1],fov:24,near:10,far:200000}} aria-label="Quote design perspective"><color attach="background" args={['#f6f5f1']}/><StudioTreatment.Provider value={true}><PreviewLighting studio review/><PreviewCamera bounds={bounds} fitPoints={points} overviewDirection={direction} preserveUserCamera fitPadding={.83} framingKey={generation} studio enabled reset={0} fit={frame} surroundings={!!houses.length}/><mesh receiveShadow position={[0,0,-5]}><planeGeometry args={[200000,200000]}/><meshStandardMaterial color="#e9e5dc" roughness={1}/></mesh>{houses.map(h=><StudioHouseNode key={h.house.id} geometry={h} selected={false} onSelect={()=>{}} refined/>)}{rows.map(row=>row.geometry&&row.position&&row.design?<StudioProductContext key={row.object.id} row={row} active={false} night={false}><group position={[row.position.x,row.position.y,0]} rotation={[0,0,row.position.rotation*Math.PI/180]}><PreviewProductNode scene={row.geometry.viewerScene} covering={row.geometry.covering} reviewSetting/>{!row.error&&row.studioAttachment?.method==='soffit'&&houses.filter(h=>h.house.id===row.studioAttachment!.houseId).map(h=><WebsiteConnectionDetail key={h.house.id} house={h.house} side={row.studioAttachment!.edge} assembly={row.geometry!.assembly} pose={row.position!} widthMm={row.design!.input.widthMm}/>)}</group></StudioProductContext>:null)}<Capture signal={signal} onReady={ready} onError={fail}/></StudioTreatment.Provider></Canvas></div>

 <details className={css.viewPlan}><summary>Plan view</summary><svg ref={plan} aria-label="Quote design Plan" viewBox={`${minX-margin} ${-maxY-margin} ${maxX-minX+2*margin} ${maxY-minY+2*margin}`}><g transform="scale(1 -1)">{houses.map(h=><g key={h.house.id}><polygon points={h.footprint.map(p=>`${p.x},${p.y}`).join(' ')} fill="#ddd8cc" stroke="#747970" strokeWidth={15}/>{h.roof.map((p,i)=><polygon key={i} points={p.map(v=>`${v.x},${v.y}`).join(' ')} fill="none" stroke="#999f96" strokeWidth={8}/>)}</g>)}{rows.map((row,i)=>row.geometry&&row.position&&row.design?<StudioProductContext key={row.object.id} row={row} active={false} night={false}><g transform={`translate(${row.position.x} ${row.position.y}) rotate(${row.position.rotation})`}><PreviewPlanProduct plan={row.geometry.plan} covering={row.geometry.covering} roofPlanes={row.geometry.assembly.roofPlanes} flashings={row.geometry.assembly.roofFlashings} profile={row.design.roof.finish?.profile} trayWidth={row.design.roof.finish?.trayWidth} scale={.065} idPrefix={`quote-${i}`} inlineDefs readOnly showRoofFallLabel={false}/></g></StudioProductContext>:null)}{joins.filter(j=>j.witness).map(j=>{const w=j.witness!,n=w.normal,t={x:-n.y,y:n.x},a=Math.min(...w.contact.map(p=>p.x)),b=Math.max(...w.contact.map(p=>p.x));return <line key={j.join.id} x1={n.x*w.plane+t.x*a} y1={n.y*w.plane+t.y*a} x2={n.x*w.plane+t.x*b} y2={n.y*w.plane+t.y*b} stroke="#826344" strokeWidth={35}/>;})}</g></svg></details>

 {rows.some(r=>r.error)&&<p role="alert">Connection or selection needs repair. The model is a retained reference; capture and quote preparation stay unavailable.</p>}
 {!points.length&&<p>Add a pergola or existing house in the editor to capture design views.</p>}
 {manualCapture&&<button className={css.primary} disabled={disabled||capturing||!points.length||rows.some(r=>r.error)} onClick={beginCapture}>{capturing?'Capturing views…':documentTarget==='booklet'?'Capture design views':'Capture quote views'}</button>}{message&&<p role="status">{message}</p>}</section>;

}
