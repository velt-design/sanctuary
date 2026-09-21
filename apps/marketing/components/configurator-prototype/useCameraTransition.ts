import { useCallback, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';

/** Framing may adapt to a new footprint; selections must not throw the view. */
export function useCameraTransition(record: () => void) {
  const { camera, invalidate } = useThree();
  const destination = useRef<{ position: Vector3; target: Vector3; fov: number; orbit: OrbitControls } | null>(null);
  const cancel = useCallback(() => { destination.current = null; }, []);
  const move = useCallback((orbit: OrbitControls, before: { position: Vector3; target: Vector3; fov: number }, immediate: boolean) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      destination.current = null;
      record();
      return;
    }
    destination.current = { position: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov, orbit };
    camera.position.copy(before.position);
    orbit.target.copy(before.target);
    camera.fov = before.fov;
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [camera, invalidate, record]);
  useFrame((_, delta) => {
    const goal = destination.current;
    if (!goal || !(camera instanceof PerspectiveCamera)) return;
    const amount = 1 - Math.exp(-12 * Math.min(delta, .05));
    camera.position.lerp(goal.position, amount);
    goal.orbit.target.lerp(goal.target, amount);
    camera.fov += (goal.fov - camera.fov) * amount;
    if (camera.position.distanceTo(goal.position) < .5 && goal.orbit.target.distanceTo(goal.target) < .5 && Math.abs(camera.fov - goal.fov) < .01) {
      camera.position.copy(goal.position);
      goal.orbit.target.copy(goal.target);
      camera.fov = goal.fov;
      destination.current = null;
    }
    camera.updateProjectionMatrix();
    goal.orbit.update();
    record();
    invalidate();
  });
  return { move, cancel };
}
