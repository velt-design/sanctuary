'use client';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import { buildRepresentativeBlind, type BlindMesh, type BlindOpening } from '@sp/geometry';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { blindColour, blindFabric, type PreviewBlind } from './blindCatalog';
function Part({data,blind}:{data:BlindMesh;blind:PreviewBlind}) {
  const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(data.positions,3));g.setIndex(data.indices);g.computeVertexNormals();return g;},[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const screen=data.kind==='fabric',pvc=blind.fabric==='pvc',clear=blind.colour==='Clear';
  const opacity=data.kind==='infill'?.24:screen?(pvc?(clear?.14:.35):.8-blindFabric(blind).openness*.018):1;
  return <mesh name={data.id} geometry={geometry} renderOrder={screen?3:0}><meshStandardMaterial side={DoubleSide} color={data.kind==='frame'?'#242824':screen?(pvc?'#a9b7b2':blindColour(blind.colour)):'#b5d1cd'} roughness={screen&&!pvc?.92:.38} metalness={data.kind==='frame'?.25:0} transparent={opacity<1} opacity={opacity} depthWrite={opacity===1}/></mesh>;
}
function Blind({opening,blind,onSelect}:{opening:BlindOpening;blind:PreviewBlind;onSelect:()=>void}) {
  const parts=useMemo(()=>buildRepresentativeBlind(opening,blind),[opening,blind]);
  return <group name={'ziptrak-'+opening.id} onClick={event=>{if(event.delta<6){event.stopPropagation();onSelect();}}}>{parts.map(part=><Part key={part.id} data={part} blind={blind}/>)}</group>;
}
function OpeningTarget({opening,active,editing,onSelect}:{opening:BlindOpening;active:boolean;editing:boolean;onSelect:()=>void}) {
  const geometry=useMemo(()=>{const g=new BufferGeometry(),{start:a,end:b,top}=opening;g.setAttribute('position',new Float32BufferAttribute([a.x,a.y,50,b.x,b.y,50,b.x,b.y,top,a.x,a.y,top],3));g.setIndex([0,1,2,0,2,3]);return g;},[opening]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} onClick={event=>{if(event.delta<6){event.stopPropagation();onSelect();}}}><meshBasicMaterial side={DoubleSide} color={active?'#a7bc87':'#afbab0'} transparent opacity={editing?(active?.24:.07):0} depthWrite={false}/></mesh>;
}
export default function PreviewBlinds({workspace}:{workspace:NonNullable<ReturnType<typeof usePreviewBlinds>>}) {
  return <group>{workspace.openings.map(o=>{const blind=workspace.blinds.find(b=>b.opening===o.id);return <group key={o.id}>{blind&&<Blind opening={o} blind={blind} onSelect={()=>workspace.select(o.id)}/>} {(workspace.editing||blind)&&<OpeningTarget opening={o} active={o.id===workspace.selected} editing={workspace.editing} onSelect={()=>workspace.select(o.id)}/>}</group>;})}</group>;
}
