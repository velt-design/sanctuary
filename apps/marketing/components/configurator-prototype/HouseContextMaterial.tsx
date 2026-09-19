import { useEffect, useMemo } from 'react';
import { useStudioTreatment } from './StudioTreatment';
import { MeshStandardMaterial } from 'three';

export default function HouseContextMaterial({ color, fadeAbove, refined = false }: { color: string; fadeAbove: number; refined?: boolean }) {
  const studio=useStudioTreatment();
  const material = useMemo(() => {
    const value = new MeshStandardMaterial({ color: studio ? '#e4ded1' : color, roughness: .95, transparent: true });
    value.onBeforeCompile = shader => {
      shader.uniforms.contextFadeStart = { value: fadeAbove };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vContextZ;\nvarying vec3 vPlaster;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvContextZ = (modelMatrix * vec4(transformed, 1.0)).z; vPlaster=(modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vContextZ;\nvarying vec3 vPlaster;\nuniform float contextFadeStart;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(contextFadeStart, contextFadeStart + '+(refined?'850.0':'1600.0')+', vContextZ) * '+(studio ? '1.0' : '0.85')+';'+(refined?'\nfloat plaster=sin(vPlaster.x*.13+sin(vPlaster.z*.09))*sin(vPlaster.z*.17);float wash=sin(vPlaster.x*.0017+sin(vPlaster.z*.0011));diffuseColor.rgb*=1.0+plaster*.015+wash*.012;':''));
    };
    value.customProgramCacheKey = () => refined ? 'studio-rendered-wall-v2' : studio ? 'studio-house-soft-top-v1' : 'preview-house-soft-top-v1';
    return value;
  }, [color, fadeAbove, studio, refined]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
