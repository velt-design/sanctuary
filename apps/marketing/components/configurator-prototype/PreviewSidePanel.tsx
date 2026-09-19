'use client';
import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,DoubleSide,MeshStandardMaterial,Vector3} from 'three';
import {buildRepresentativeSidePanel,type BlindOpening,type SidePanelMesh} from '@sp/geometry';
import type {SidePanel} from './sidePanelCatalog';
import {useStudioTreatment} from './StudioTreatment';
import {sidePanelSupports} from './sidePanelLayout';
function Part({part,species,along,across}:{part:SidePanelMesh;species?:SidePanel['species'];along:Vector3;across:Vector3}){
  const studio=useStudioTreatment();
  const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(part.positions,3));g.setIndex(part.indices);g.computeVertexNormals();return g;},[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useMemo(()=>{
    const value=new MeshStandardMaterial({side:DoubleSide,color:part.kind==='timber'?(species==='thermopine'?'#9a7952':'#aa7950'):part.kind==='acrylic'?'#b5d1cd':'#242824',roughness:part.kind==='timber'?(studio?.8:.88):(studio?.35:.4),metalness:part.kind==='frame'?.25:0,transparent:part.kind==='acrylic',opacity:part.kind==='acrylic'?.25:1,depthWrite:part.kind!=='acrylic'});
    if(studio&&part.kind==='timber'){
      // A mesh contains all battens: its overall bounds do not describe their grain direction.
      value.onBeforeCompile=shader=>{
        shader.uniforms.uGrainAlong={value:along};shader.uniforms.uGrainAcross={value:across};
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGrain;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGrain=position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGrain;uniform vec3 uGrainAlong;uniform vec3 uGrainAcross;').replace('#include <color_fragment>','#include <color_fragment>\nfloat across=dot(vGrain,uGrainAcross);float along=dot(vGrain,uGrainAlong);float g=sin(across*.16+sin(along*.003)*2.0)*sin(across*.043);diffuseColor.rgb*=.95+g*.14;');
      };value.customProgramCacheKey=()=> 'studio-side-grain-directed-v2';
    }
    return value;
  },[studio,part.kind,species,along,across]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh geometry={geometry} material={material}/>;
}
export default function PreviewSidePanel({opening,panel,onSelect}:{opening:BlindOpening;panel:SidePanel;onSelect:()=>void}){
  const grain=useMemo(()=>{
    const span=new Vector3(opening.end.x-opening.start.x,opening.end.y-opening.start.y,0).normalize();
    const vertical=panel.kind!=='acrylic'&&panel.direction==='vertical';
    return {along:vertical?new Vector3(0,0,1):span,across:vertical?span:new Vector3(0,0,1)};
  },[opening.start.x,opening.start.y,opening.end.x,opening.end.y,panel.kind,panel.direction]);
  const parts=useMemo(()=>buildRepresentativeSidePanel(opening,panel,sidePanelSupports(opening,panel)),[opening,panel]);
  return <group name={'side-panel-'+opening.id} onClick={e=>{if(e.delta<6){e.stopPropagation();onSelect();}}}>{parts.map((part,i)=><Part key={i} part={part} species={panel.species} along={grain.along} across={grain.across}/>)}</group>;
}
