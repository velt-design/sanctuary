import { useEffect, useMemo } from 'react';
import { DoubleSide, MeshPhysicalMaterial } from 'three';
import type { ViewerSceneRoofPlaneObject, ViewerSceneRoofCladdingPanelObject } from '@sp/geometry';
import { buildPolygonGeometry, buildPolygonSlabGeometry } from '@sp/geometry-viewer/three';

export default function PreviewRoof({ object }: {
  object: ViewerSceneRoofPlaneObject | ViewerSceneRoofCladdingPanelObject;
}) {
  const geometry = useMemo(() => object.type === 'roof_cladding_panel'
    ? buildPolygonSlabGeometry(object.boundary, object.plane, object.thicknessMm)
    : buildPolygonGeometry(object.boundary), [object]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(() => {
    const value = new MeshPhysicalMaterial({ color: '#83aaa6', transparent: true, opacity: .38, roughness: .16,
      metalness: 0, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.7, ior: 1.49,
      side: DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    value.forceSinglePass = true;
    value.onBeforeCompile = shader => {
      // A restrained studio reflection cue stays continuous across panel boundaries.
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAcrylicPoint;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvAcrylicPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAcrylicPoint;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat sweep = vAcrylicPoint.x * 0.00018 + vAcrylicPoint.y * 0.00012;\nfloat reflection = smoothstep(0.43, 0.51, sweep) * (1.0 - smoothstep(0.66, 0.78, sweep));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.91, 0.95, 0.94), reflection * 0.38);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nfloat acrylicEdge = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);\ndiffuseColor.a = mix(diffuseColor.a, 0.68, acrylicEdge);');
    };
    value.customProgramCacheKey = () => 'preview-acrylic-edge-v2';
    return value;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} renderOrder={1}>
    {/* The reference plane meets the frame exactly. Bias only its depth so the
        opaque aluminium wins at that boundary; never move solved geometry. */}
    <primitive object={material} attach="material" />
  </mesh>;
}
