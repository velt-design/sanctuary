import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { ViewerSceneObject } from '@sp/geometry';

/** Presentation shading only: two-millimetre edge roll, no new geometry/draws. */
export default function StructuralFinish({ enabled, objects, children }: { enabled: boolean; objects: ViewerSceneObject[]; children: ReactNode }) {
  const group = useRef<Group>(null);
  useLayoutEffect(() => enabled && group.current ? applyStructuralFinish(group.current, objects) : undefined, [enabled, objects]);
  return <group ref={group}>{children}</group>;
}
export function applyStructuralFinish(group: Group, objects: ViewerSceneObject[]) {
    const members = new Set(objects.filter(object => object.type === 'member_prism').map(object => `scene-object-${object.sourceId ?? object.id}`));
    const restore: (() => void)[] = [];
    group.traverse(node => {
      if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) return;
      let owner = node as typeof node.parent;
      while (owner && owner !== group && !members.has(owner.name)) owner = owner.parent;
      if (!owner || !members.has(owner.name)) return;
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (!box) return;
      const original = node.material, material = original.clone();
      material.onBeforeCompile = shader => {
        shader.uniforms.uFinishMin = { value: box.min.clone() };
        shader.uniforms.uFinishMax = { value: box.max.clone() };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFinishPosition; varying vec3 vFinishNormal; varying mat3 vFinishNormalMatrix;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinishPosition=position; vFinishNormal=normal; vFinishNormalMatrix=normalMatrix;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFinishPosition; varying vec3 vFinishNormal; varying mat3 vFinishNormalMatrix; uniform vec3 uFinishMin; uniform vec3 uFinishMax;')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            vec3 edgeDistance=min(vFinishPosition-uFinishMin,uFinishMax-vFinishPosition);
            vec3 faceSign=sign(vFinishPosition-(uFinishMin+uFinishMax)*.5);
            vec3 edgeWeight=1.0-smoothstep(vec3(0.0),vec3(2.0),edgeDistance);
            vec3 localNormal=normalize(vFinishNormal);
            // Only roll rectangular exterior corners, retaining solved profile grooves/cuts.
            if(max(abs(localNormal.x),max(abs(localNormal.y),abs(localNormal.z)))>.99){
              vec3 neighbour=edgeWeight*faceSign*(1.0-abs(localNormal));
              normal=normalize(normal+vFinishNormalMatrix*neighbour*.45);
            }`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            float grain=sin(vFinishPosition.x*.13+vFinishPosition.y*.17)*sin(vFinishPosition.z*.19);
            float filterWidth=max(length(dFdx(vFinishPosition)),length(dFdy(vFinishPosition)));
            roughnessFactor=clamp(roughnessFactor+grain*.025*(1.0-smoothstep(3.0,18.0,filterWidth)),.3,1.0);`);
      };
      material.customProgramCacheKey = () => 'marketing-structural-edge-roll-v1';
      node.material = material;
      restore.push(() => { if (node.material === material) node.material = original; material.dispose(); });
    });
    return () => restore.forEach(fn => fn());
}
