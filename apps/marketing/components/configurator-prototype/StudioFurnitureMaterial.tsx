import { useEffect, useMemo } from 'react';
import { MeshPhysicalMaterial, Vector3 } from 'three';

/** Fine, derivative-filtered finish detail; no image downloads or extra render loop. */
export default function StudioFurnitureMaterial({ color, finish, size }: { color: string; finish: 'fabric' | 'stone' | 'frame' | 'wood'; size?: [number, number, number] }) {
  const [width = 0, depth = 0, height = 0] = size ?? [];
  const material = useMemo(() => {
    const m = new MeshPhysicalMaterial({ color, roughness: finish === 'frame' ? .48 : finish === 'wood' ? .65 : .88, metalness: finish === 'frame' ? .25 : 0,
      sheen: finish === 'fabric' ? .35 : 0, sheenRoughness: .85, sheenColor: '#eee6d8' });
    if (finish === 'fabric' || finish === 'stone') {
      m.onBeforeCompile = shader => {
        const dimensions = [width, depth, height];
        const axis = dimensions.indexOf(Math.min(...dimensions));
        shader.uniforms.uSeamAxis = { value: new Vector3(axis===0?1:0, axis===1?1:0, axis===2?1:0) };
        shader.uniforms.uSeamEdge = { value: dimensions[axis] / 2 - 12 };
        shader.uniforms.uSeamStrength = { value: finish === 'fabric' && width > 0 ? .16 : 0 };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFurniture;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurniture=position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFurniture; uniform vec3 uSeamAxis; uniform float uSeamEdge; uniform float uSeamStrength;').replace('#include <color_fragment>', `#include <color_fragment>
          vec3 p = vFurniture;
          float grain = sin(p.x*.17+sin(p.z*.11))*sin(p.y*.19+p.z*.13);
          ${finish === 'fabric' ? `vec3 frequency = fwidth(p * 2.2);
          vec3 weave = sin(p * 2.2) * (1.0-smoothstep(vec3(.4),vec3(2.0),frequency));
          float detail = (weave.x+weave.y+weave.z)*.012 + grain*.022;` : 'float detail = grain*.025 + sin(p.x*.013+p.y*.021+p.z*.018)*.035;'}
          float seamCoordinate = dot(p,uSeamAxis);
          float aa = max(fwidth(seamCoordinate), .5);
          float seam = 1.0-smoothstep(.6,.6+aa,abs(abs(seamCoordinate)-uSeamEdge));
          diffuseColor.rgb *= 1.0 + detail - seam * uSeamStrength * min(1.0,1.5/aa);`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + detail * 1.5, .55, 1.0);`);
      };
      m.customProgramCacheKey = () => `furniture-${finish}-v2`;
    }
    return m;
  }, [color, finish, width, depth, height]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material"/>;
}
