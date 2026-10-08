import { useEffect, useMemo } from 'react';
import { MeshPhysicalMaterial, Vector3 } from 'three';
import { useRealismStudy } from './RealismStudy';

/** Fine, derivative-filtered finish detail; no image downloads or extra render loop. */
export default function StudioFurnitureMaterial({ color, finish, size }: { color: string; finish: 'fabric' | 'stone' | 'frame' | 'wood'; size?: [number, number, number] }) {
  const [width = 0, depth = 0, height = 0] = size ?? [];
  const realism = useRealismStudy();
  const timberTop = realism && finish === 'stone' && height > 0 && height < 100 && width > height * 3;
  const material = useMemo(() => {
    const tone = timberTop ? '#94714d' : realism && color === '#ded8ca' ? '#b9b09e' : realism && color === '#414441' ? '#636b60' : color;
    const m = new MeshPhysicalMaterial({ color: tone, roughness: finish === 'frame' ? .48 : finish === 'wood' ? .65 : .88, metalness: finish === 'frame' ? .25 : 0,
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
          float detail = (weave.x+weave.y+weave.z)*.012 + grain*.022;` : timberTop ? 'float grainWidth = max(fwidth(p.y * .09), .001); float detail = sin(p.y*.09+sin(p.x*.003)*2.0)*.07*(1.0-smoothstep(.4,2.0,grainWidth)) + sin(p.y*.022+p.x*.0007)*.045;' : 'float detail = grain*.025 + sin(p.x*.013+p.y*.021+p.z*.018)*.035;'}
          float seamCoordinate = dot(p,uSeamAxis);
          float aa = max(fwidth(seamCoordinate), .5);
          float seam = 1.0-smoothstep(.6,.6+aa,abs(abs(seamCoordinate)-uSeamEdge));
          diffuseColor.rgb *= 1.0 + detail - seam * uSeamStrength * min(1.0,1.5/aa);`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + detail * 1.5, .55, 1.0);`);
      };
      m.customProgramCacheKey = () => `furniture-${finish}-${timberTop ? "timber" : "original"}-v3`;
    }
    return m;
  }, [color, finish, width, depth, height, realism, timberTop]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material"/>;
}
