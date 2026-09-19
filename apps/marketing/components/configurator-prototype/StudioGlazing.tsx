import { useEffect, useMemo } from 'react';
import { MeshPhysicalMaterial } from 'three';
import type { ContextBox } from '@sp/geometry';

/** Quiet sky reflection and darker recessed edges, without external textures. */
export default function StudioGlazing({ box }: { box: ContextBox }) {
  const material=useMemo(()=>{
    const m=new MeshPhysicalMaterial({color:'#899b96',roughness:.17,metalness:.2,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.85,transparent:true});
    m.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vWindow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWindow=uv;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vWindow;').replace('#include <color_fragment>',`#include <color_fragment>
        float edge=min(min(vWindow.x,1.0-vWindow.x),min(vWindow.y,1.0-vWindow.y));
        diffuseColor.rgb*=mix(.75,1.0,smoothstep(0.0,.09,edge));
        float sky=smoothstep(.2,.95,vWindow.y);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.78,.77),sky*.23);`);
    };
    m.customProgramCacheKey=()=> 'studio-recessed-glass-v1';
    return m;
  },[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const {min,max}=box;
  return <mesh name={box.id} position={[(min.x+max.x)/2,(min.y+max.y)/2,(min.z+max.z)/2]} material={material}>
    <boxGeometry args={[max.x-min.x,max.y-min.y,max.z-min.z]}/>
  </mesh>;
}
