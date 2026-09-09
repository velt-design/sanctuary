'use client';

import { useCallback, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrthographicCamera, Vector3 } from 'three';
import type { SceneBounds } from '@sp/geometry-viewer';
import type { Point3 } from '@sp/geometry';

// Front posts face +Y; this three-quarter angle follows the customer's reference.
const FRONT_DIRECTION = new Vector3(1, 1.7, 1.25).normalize();

export default function PreviewCamera({ under = 0, bounds, fitPoints, enabled, reset, fit, surroundings }: {
  under?: number; bounds: SceneBounds; fitPoints: Point3[]; enabled: boolean; reset: number; fit: number; surroundings: boolean;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previous = useRef<{ reset: number; under: number; fit: number; width: number; height: number } | null>(null);
  const touched = useRef(false);
  const ceilingMode = useRef(false);

  const recordCamera = useCallback(() => {
    if (!(camera instanceof OrthographicCamera) || !controls.current) return;
    gl.domElement.dataset.camera = JSON.stringify({
      position: camera.position.toArray(), target: controls.current.target.toArray(), zoom: camera.zoom,
    });
  }, [camera, gl]);

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!(camera instanceof OrthographicCamera) || !orbit || !size.width || !size.height) return;
    const initialise = !previous.current || previous.current.reset !== reset;
    const centre = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    const showUnder = under > 0 && previous.current?.under !== under;
    if (showUnder) ceilingMode.current = true;
    else if (initialise) ceilingMode.current = false;
    if (ceilingMode.current) centre.z = Math.max(...fitPoints.map(p => p.z)) - 350;
    if (showUnder) {
      touched.current = false;
      camera.position.set(centre.x, Math.max(...fitPoints.map(p => p.y)) + 1000, 1200);
    } else if (initialise) {
      touched.current = false;
      camera.position.copy(centre).addScaledVector(FRONT_DIRECTION, bounds.size * 3);
    } else {
      // Move with the model's centre without changing the user's orbit or scale.
      camera.position.add(centre.clone().sub(orbit.target));
    }
    orbit.target.copy(centre);
    camera.up.set(0, 0, 1);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
    if (!touched.current || previous.current?.fit !== fit) {
      let width = 1;
      let height = 1;
      for (const { x, y, z } of fitPoints) {
        const point = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        width = Math.max(width, Math.abs(point.x) * 2);
        height = Math.max(height, Math.abs(point.y) * 2);
      }
      camera.zoom = Math.min(size.width * (size.width < 600 ? .92 : .86) / width, Math.max(1, size.height - (size.height < 320 ? 16 : 40)) / height) * (surroundings ? .9 : 1);
    } else if (previous.current && (previous.current.width !== size.width || previous.current.height !== size.height)) {
      // Keep the explored framing proportional when expanding or rotating the screen.
      // Dimension edits still retain the exact zoom and angle.
      camera.zoom *= Math.min(size.width, size.height) / Math.min(previous.current.width, previous.current.height);
    }
    camera.setViewOffset(size.width, size.height, 0, 0, size.width, size.height);
    camera.updateProjectionMatrix();
    orbit.update();
    previous.current = { reset, under, fit, width: size.width, height: size.height };
    recordCamera();
    invalidate();
  }, [under, bounds, fitPoints, camera, size.width, size.height, reset, fit, surroundings, invalidate, recordCamera]);

  return <OrbitControls ref={controls} makeDefault enabled={enabled} enablePan={false}
    enableDamping={false} minZoom={.005} maxZoom={1} minPolarAngle={.15} maxPolarAngle={Math.PI * .75}
    onStart={() => { touched.current = true; }} onChange={recordCamera} />;
}
