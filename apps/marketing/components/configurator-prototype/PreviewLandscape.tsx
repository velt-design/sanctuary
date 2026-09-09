import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Mesh, MeshStandardMaterial, OrthographicCamera, Vector3 } from 'three';
import type { RepresentativeSurroundings } from '@sp/geometry';
import type { SceneBounds } from '@sp/geometry-viewer';
import ReferenceTreeMeshes from './ReferenceTreeMeshes';
import { foliageOverlapsProduct } from './foliageOverlap';

type Point3 = { x: number; y: number; z: number };

function Tree({ geometry, bounds, productPoints }: {
  geometry: RepresentativeSurroundings['trees'][number]; bounds: SceneBounds; productPoints: Point3[];
}) {
  const { position: { x, y, z }, radiusMm: radius, specimen } = geometry;
  const tree = useRef<Group>(null);
  const scratch = useMemo(() => ({ centre: new Vector3(), point: new Vector3() }), []);
  const opacity = useRef(1);
  const crown = useMemo(() => {
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const leaf of specimen.leaves) for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] = Math.min(min[axis], leaf.center[axis] - leaf.size);
      max[axis] = Math.max(max[axis], leaf.center[axis] + leaf.size);
    }
    const corners: Point3[] = [];
    for (const cx of [min.x, max.x]) for (const cy of [min.y, max.y]) for (const cz of [min.z, max.z]) corners.push({ x: cx, y: cy, z: cz });
    return { corners, centre: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 } };
  }, [specimen]);
  useFrame(({ camera, invalidate }, delta) => {
    if (!(camera instanceof OrthographicCamera)) return;
    const corners: { x: number; y: number }[] = [];
    // Solved member/roof points avoid treating empty rear floor corners as product.
    for (const point of productPoints) {
      scratch.point.set(point.x, point.y, point.z).project(camera);
      corners.push({ x: scratch.point.x, y: scratch.point.y });
    }
    scratch.centre.set(x + crown.centre.x, y + crown.centre.y, z + crown.centre.z).project(camera);
    let rx = 0, ry = 0;
    for (const point of crown.corners) {
      scratch.point.set(x + point.x, y + point.y, z + point.z).project(camera);
      rx = Math.max(rx, Math.abs(scratch.point.x - scratch.centre.x));
      ry = Math.max(ry, Math.abs(scratch.point.y - scratch.centre.y));
    }
    const overlaps = foliageOverlapsProduct(corners, scratch.centre, rx, ry);
    scratch.point.set(bounds.center.x, bounds.center.y, bounds.center.z).project(camera);
    const inFront = scratch.centre.z < scratch.point.z;
    const target = overlaps && inFront ? .08 : 1;
    opacity.current = MathUtils.damp(opacity.current, target, 14, Math.min(delta, .1));
    if (Math.abs(opacity.current - target) > .005) invalidate();
    tree.current?.traverse(object => {
      if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
        object.material.opacity = opacity.current;
        object.material.depthWrite = opacity.current > .98;
      }
    });
  });
  return <group ref={tree} position={[x, y, z]} name="context-tree">
    <ReferenceTreeMeshes specimen={specimen} />
    <mesh position={[300, 250, 2]} renderOrder={1} scale={[radius / 1250, radius / 1250, 1]}>
      <planeGeometry args={[3200, 2800]} />
      <shaderMaterial transparent depthWrite={false}
        vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader="varying vec2 vUv; void main(){vec2 p=vUv-.5;vec2 root=p+vec2(.09375,.0893);float a=exp(-dot(p,p)*19.0)*.22+exp(-dot(root,root)*900.0)*.3;gl_FragColor=vec4(.27,.29,.22,a);}" />
    </mesh>
  </group>;
}

export default function PreviewLandscape({ context, bounds, productPoints }: { context: RepresentativeSurroundings; bounds: SceneBounds; productPoints: Point3[] }) {
  return <group name="landscape-context">
    {context.trees.map((geometry, index) => <Tree key={index} geometry={geometry} bounds={bounds} productPoints={productPoints} />)}
  </group>;
}
