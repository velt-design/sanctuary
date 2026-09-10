'use client';
import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,DoubleSide} from 'three';
import {buildRepresentativeSidePanel,type BlindOpening,type SidePanelMesh} from '@sp/geometry';
import type {SidePanel} from './sidePanelCatalog';
import {sidePanelSupports} from './sidePanelLayout';
function Part({part}:{part:SidePanelMesh}){
  const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(part.positions,3));g.setIndex(part.indices);g.computeVertexNormals();return g;},[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial side={DoubleSide} color={part.kind==='timber'?'#aa7950':part.kind==='acrylic'?'#b5d1cd':'#242824'} roughness={part.kind==='timber'?.88:.4} metalness={part.kind==='frame'?.25:0} transparent={part.kind==='acrylic'} opacity={part.kind==='acrylic'?.25:1} depthWrite={part.kind!=='acrylic'}/></mesh>;
}
export default function PreviewSidePanel({opening,panel,onSelect}:{opening:BlindOpening;panel:SidePanel;onSelect:()=>void}){
  const parts=useMemo(()=>buildRepresentativeSidePanel(opening,panel,sidePanelSupports(opening,panel)),[opening,panel]);
  return <group name={'side-panel-'+opening.id} onClick={e=>{if(e.delta<6){e.stopPropagation();onSelect();}}}>{parts.map((part,i)=><Part key={i} part={part}/>)}</group>;
}
