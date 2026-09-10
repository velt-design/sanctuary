'use client';

import { useCallback, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { SceneBounds } from '@sp/geometry-viewer';
import type { Point3 } from '@sp/geometry';

const FRONT_DIRECTION = new Vector3(1, 1.7, 1.25).normalize();

export default function PreviewCamera({ bounds, fitPoints, enabled, reset, fit, surroundings }: {
  bounds: SceneBounds; fitPoints: Point3[]; enabled: boolean; reset: number; fit: number; surroundings: boolean;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previous = useRef<{ reset: number; fit: number } | null>(null);
  const touched = useRef(false);
  const recordCamera = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    gl.domElement.dataset.camera = JSON.stringify({ projection: 'perspective', fov: camera.fov,
      position: camera.position.toArray(), target: controls.current.target.toArray(), zoom: camera.zoom,
      distance: camera.position.distanceTo(controls.current.target) });
  }, [camera, gl]);

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!(camera instanceof PerspectiveCamera) || !orbit || !size.width || !size.height) return;
    const initialise = !previous.current || previous.current.reset !== reset;
    const centre = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    if (initialise) {
      touched.current = false;
      camera.position.copy(centre).addScaledVector(FRONT_DIRECTION, bounds.size * 3);
    } else camera.position.add(centre.clone().sub(orbit.target));
    orbit.target.copy(centre);
    camera.up.set(0, 0, 1);
    camera.aspect = size.width / size.height;
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    if (!touched.current || previous.current?.fit !== fit) {
      const direction = camera.position.clone().sub(centre).normalize();
      const oldDistance = camera.position.distanceTo(centre);
      const tanY = Math.tan(camera.fov * Math.PI / 360);
      const paddingX = (size.width < 600 ? .92 : .86) * (surroundings ? .9 : 1);
      const paddingY = Math.max(.5, (size.height - (size.height < 320 ? 16 : 40)) / size.height) * (surroundings ? .9 : 1);
      let distance = 1000;
      for (const p of fitPoints) {
        const point = new Vector3(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse);
        const depth = point.z + oldDistance;
        distance = Math.max(distance, depth + Math.abs(point.x) / (tanY * camera.aspect * paddingX),
          depth + Math.abs(point.y) / (tanY * paddingY));
      }
      camera.position.copy(centre).addScaledVector(direction, distance);
    }
    camera.updateProjectionMatrix();
    orbit.update();
    previous.current = { reset, fit };
    recordCamera();
    invalidate();
  }, [bounds, fitPoints, camera, size.width, size.height, reset, fit, surroundings, invalidate, recordCamera]);

  return <OrbitControls ref={controls} makeDefault enabled={enabled} enablePan={false}
    enableDamping={false} minDistance={1000} maxDistance={100000} minPolarAngle={.15} maxPolarAngle={Math.PI * .48}
    onStart={() => { touched.current = true; }} onChange={recordCamera} />;
}
