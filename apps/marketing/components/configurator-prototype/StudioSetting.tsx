import { useEffect, useMemo } from 'react';
import StudioFurniture from './StudioFurniture';
import { MeshStandardMaterial } from 'three';
import type { GeometryPlanViewModel, RepresentativeSurroundings } from '@sp/geometry';


/** Unpriced setting only. Furniture is omitted where there is no generous clearance. */
export default function StudioSetting({ plan, context }: { plan: GeometryPlanViewModel; context: RepresentativeSurroundings | null }) {
  const { minX, minY, maxX, maxY } = plan.extents;
  const width = maxX - minX, depth = maxY - minY;
  const terrace = context?.architecture.terrace;
  const floor = terrace?.max.z ?? 0;
  const terraceMinX=terrace?.min.x??minX-450, terraceMaxX=terrace?.max.x??maxX+450;
  const terraceMinY=terrace?.min.y??minY-450, terraceMaxY=terrace?.max.y??maxY+450;
  const paving = useMemo(() => {
    const material = new MeshStandardMaterial({ color: '#c6b9a4', roughness: .92 });
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaving;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvPaving=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaving;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 tile = fract(vPaving.xy / vec2(1200.0,800.0));
          vec2 aa = max(fwidth(tile),vec2(.001));
          vec2 edge = min(tile,1.0-tile);
          float seam = max(1.0-smoothstep(.001,.003+aa.x,edge.x),1.0-smoothstep(.001,.003+aa.y,edge.y));
          float stone = sin(vPaving.x*.037+sin(vPaving.y*.029))*sin(vPaving.y*.073);
          vec2 slab = floor(vPaving.xy / vec2(1200.0,800.0));
          float slabTone = fract(sin(dot(slab,vec2(12.9898,78.233)))*43758.5453)-.5;
          diffuseColor.rgb *= 1.0 - seam*.14 + stone*.018 + slabTone*.055;`);
    };
    material.customProgramCacheKey = () => 'studio-paving-v3';
    return material;
  }, []);
  useEffect(() => () => paving.dispose(), [paving]);
  return <group name="illustrative-setting">
    {!context?.elevated && <mesh position={[(minX+maxX)/2,(minY+maxY)/2,-4]} rotation={[0,0,0]}>
      <planeGeometry args={[80000,80000]}/><meshStandardMaterial color="#d9d3c7" roughness={1}/>
    </mesh>}
    <mesh position={[(terraceMinX+terraceMaxX)/2,(terraceMinY+terraceMaxY)/2,floor+2]} material={paving}>
      <planeGeometry args={[terraceMaxX-terraceMinX,terraceMaxY-terraceMinY]}/>
    </mesh>
    {!terrace&&<mesh position={[(minX+maxX)/2,(minY+maxY)/2,floor-55]}><boxGeometry args={[width+900,depth+900,110]}/><meshStandardMaterial color="#bcb6a9" roughness={.9}/></mesh>}
    <StudioFurniture plan={plan} floor={floor}/>
  </group>;
}
