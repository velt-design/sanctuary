import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Object3D, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RepresentativeSurroundings } from '@sp/geometry';

export default function ReferenceTreeMeshes({ specimen }: { specimen: RepresentativeSurroundings['trees'][number]['specimen'] }) {
  const foliage = useRef<InstancedMesh>(null);
  const branchGeometry = useMemo(() => {
    const transform = new Object3D();
    const direction = new Vector3();
    const up = new Vector3(0, 1, 0);
    const parts = specimen.branches.map(({ start, end, radius, tipRadius }) => {
      direction.set(end.x - start.x, end.y - start.y, end.z - start.z);
      transform.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
      transform.quaternion.setFromUnitVectors(up, direction.clone().normalize()); transform.updateMatrix();
      return new CylinderGeometry(tipRadius, radius, direction.length(), 6).applyMatrix4(transform.matrix);
    });
    const result = mergeGeometries(parts)!;
    parts.forEach(part => part.dispose());
    return result;
  }, [specimen]);
  const leafGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    // Folded lanceolate leaves have their own silhouette; no alpha texture sorting.
    geometry.setAttribute('position', new Float32BufferAttribute([
      0,-1,0, -.43,0,0, 0,0,.16, 0,-1,0, 0,0,.16, .43,0,0,
      0,1,0, 0,0,.16, -.43,0,0, 0,1,0, .43,0,0, 0,0,.16,
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => { branchGeometry.dispose(); leafGeometry.dispose(); }, [branchGeometry, leafGeometry]);
  useLayoutEffect(() => {
    const transform = new Object3D();
    const color = new Color();
    const pale = new Color('#7b844f');
    specimen.leaves.forEach(({ center, rotation, size, tone }, i) => {
      transform.position.set(center.x, center.y, center.z);
      transform.rotation.set(rotation.x, rotation.y, rotation.z);
      transform.scale.setScalar(size); transform.updateMatrix();
      foliage.current!.setMatrixAt(i, transform.matrix);
      color.set('#3d5126').lerp(pale, tone);
      foliage.current!.setColorAt(i, color);
    });
    foliage.current!.instanceMatrix.needsUpdate = true; foliage.current!.computeBoundingSphere();
    if (foliage.current!.instanceColor) foliage.current!.instanceColor.needsUpdate = true;
  }, [specimen]);
  return <>
    <mesh geometry={branchGeometry}>
      <meshStandardMaterial color="#777363" roughness={1} transparent />
    </mesh>
    <instancedMesh ref={foliage} args={[leafGeometry, undefined, specimen.leaves.length]}>
      <meshStandardMaterial color="#ffffff" roughness={1} side={DoubleSide} transparent />
    </instancedMesh>
  </>;
}
