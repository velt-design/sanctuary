import { useEffect, useMemo } from 'react';
import { useStudioTreatment } from './StudioTreatment';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Vector3 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RoofFinishGeometry, RoofFinishMesh } from '@sp/geometry';

function FinishMesh({ data, review }: { data: RoofFinishMesh; review: boolean }) {
  const studio = useStudioTreatment();
  const geometry = useMemo(() => {
    const mesh = new BufferGeometry();
    mesh.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    mesh.setIndex(data.indices); mesh.computeVertexNormals();
    if (studio && data.kind === 'steel') {
      // Smooth the small facets of curved corrugations, retaining the sharp
      // corners of tray/trapezoidal profiles and every solved vertex position.
      const smooth = toCreasedNormals(mesh, Math.PI / 6);
      mesh.dispose();
      return smooth;
    }
    return mesh;
  }, [data, studio]);
  const material = useMemo(() => {
    const cedar = data.kind === 'cedar';
    const value = new MeshStandardMaterial({ color: cedar ? (data.timberSpecies === 'thermopine' ? '#9a7952' : '#95633f') : '#343b39', roughness: cedar ? .82 : studio ? .58 : .4, metalness: cedar ? 0 : studio ? .25 : .45, side: DoubleSide });
    if (review && data.kind === 'steel') {
      // Area-weighted roof plane from the existing open sheet. Filter shading
      // only when profile facets approach pixel size; keep every solved vertex.
      const plane = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3();
      for (let i = 0; i < data.indices.length; i += 3) {
        a.fromArray(data.positions, data.indices[i] * 3);
        b.fromArray(data.positions, data.indices[i + 1] * 3);
        c.fromArray(data.positions, data.indices[i + 2] * 3);
        plane.add(b.sub(a).cross(c.sub(a)));
      }
      plane.normalize();
      value.roughness = .68;
      value.metalness = .18;
      value.onBeforeCompile = shader => {
        // Orient the filtered plane toward the viewer, not each tiny facet.
        // At grazing angles adjacent front/back facets otherwise alternate
        // light/dark pixels even after their high-frequency normals are filtered.
        shader.uniforms.uRoofPlane = { value: plane };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uRoofPlane; varying vec3 vRoofPlane; varying vec3 vRoofPosition;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoofPlane = normalMatrix * uRoofPlane; vRoofPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRoofPlane; varying vec3 vRoofPosition;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nfloat footprint = max(length(dFdx(vRoofPosition)), length(dFdy(vRoofPosition))); normal = normalize(mix(normal, normalize(vRoofPlane) * (dot(vRoofPlane, vViewPosition) < 0.0 ? -1.0 : 1.0), smoothstep(4.0, 18.0, footprint)));');
      };
      value.customProgramCacheKey = () => 'review-roof-filter-v1';
    } else if (cedar) {
      value.onBeforeCompile = shader => {
        shader.uniforms.uWoodAcross = { value: new Vector3(data.grainAcross?.x ?? 1, data.grainAcross?.y ?? 0, data.grainAcross?.z ?? 0) };
        shader.uniforms.uWoodAlong = { value: new Vector3(data.grainAlong?.x ?? 0, data.grainAlong?.y ?? 1, data.grainAlong?.z ?? 0) };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWood;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWood = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWood; uniform vec3 uWoodAcross; uniform vec3 uWoodAlong;')
          .replace('#include <color_fragment>', '#include <color_fragment>\nfloat across = dot(vWood, uWoodAcross); float along = dot(vWood, uWoodAlong); float grain = sin(across * .15 + sin(along * .003) * 2.0) * sin(across * .041 + along * .0008);\ndiffuseColor.rgb *= 0.95 + grain * '+(studio ? '0.16' : '0.09')+';');
      };
      value.customProgramCacheKey = () => studio ? 'studio-cedar-v1' : 'representative-cedar-v2';
    }
    return value;
  }, [studio, review, data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh name={data.id} geometry={geometry} material={material} />;
}
export default function PreviewRoofFinish({ covering, review = false }: { covering: RoofFinishGeometry; review?: boolean }) {
  return <group name="solid-roof-and-ceiling">{covering.meshes.filter(m => m.indices.length).map(mesh => <FinishMesh key={mesh.id} data={mesh} review={review} />)}</group>;
}
