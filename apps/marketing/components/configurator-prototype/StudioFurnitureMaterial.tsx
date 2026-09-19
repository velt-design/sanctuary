import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

/** Fine, derivative-filtered finish detail; no image downloads or extra render loop. */
export default function StudioFurnitureMaterial({ color, finish }: { color: string; finish: 'fabric' | 'stone' | 'frame' | 'wood' }) {
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ color, roughness: finish === 'frame' ? .48 : finish === 'wood' ? .65 : .9, metalness: finish === 'frame' ? .25 : 0 });
    if (finish === 'fabric' || finish === 'stone') {
      m.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFurniture;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurniture=position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFurniture;').replace('#include <color_fragment>', `#include <color_fragment>
          vec3 p = vFurniture;
          float grain = sin(p.x*.17+sin(p.z*.11))*sin(p.y*.19+p.z*.13);
          ${finish === 'fabric' ? `vec3 frequency = fwidth(p * 2.2);
          vec3 weave = sin(p * 2.2) * (1.0-smoothstep(vec3(.4),vec3(2.0),frequency));
          float detail = (weave.x+weave.y+weave.z)*.012 + grain*.022;` : 'float detail = grain*.025 + sin(p.x*.013+p.y*.021+p.z*.018)*.018;'}
          diffuseColor.rgb *= 1.0 + detail;`);
      };
      m.customProgramCacheKey = () => `furniture-${finish}-v1`;
    }
    return m;
  }, [color, finish]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material"/>;
}
