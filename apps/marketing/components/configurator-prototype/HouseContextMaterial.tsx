import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

export default function HouseContextMaterial({ color, fadeAbove }: { color: string; fadeAbove: number }) {
  const material = useMemo(() => {
    const value = new MeshStandardMaterial({ color, roughness: .95, transparent: true });
    value.onBeforeCompile = shader => {
      shader.uniforms.contextFadeStart = { value: fadeAbove };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vContextZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvContextZ = (modelMatrix * vec4(transformed, 1.0)).z;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vContextZ;\nuniform float contextFadeStart;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(contextFadeStart, contextFadeStart + 1600.0, vContextZ) * 0.85;');
    };
    value.customProgramCacheKey = () => 'preview-house-soft-top-v1';
    return value;
  }, [color, fadeAbove]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
