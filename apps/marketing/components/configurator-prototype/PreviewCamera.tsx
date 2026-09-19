'use client';

import { useCallback, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { SceneBounds } from '@sp/geometry-viewer';
import type { Point3 } from '@sp/geometry';

const FRONT_DIRECTION = new Vector3(1, 1.7, 1.25).normalize();
const PRESENTATION_DIRECTION = new Vector3(.85, 1.9, .65).normalize();

export default function PreviewCamera({ choiceView, explore = false, portrait = false, studio = false, bounds, fitPoints, enabled, reset, fit, surroundings, presentation = false, side }: {
  choiceView?: 'sides' | 'lighting';
  explore?: boolean; portrait?: boolean; studio?: boolean; bounds: SceneBounds; fitPoints: Point3[]; enabled: boolean; reset: number; fit: number; surroundings: boolean; presentation?: boolean; side?: string;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previous = useRef<{ reset: number; fit: number; width: number; height: number; presentation: boolean; side?: string; choiceView?: string } | null>(null);
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
    const initialise = !previous.current || previous.current.reset !== reset || previous.current.presentation !== presentation || previous.current.side !== side || previous.current.choiceView !== choiceView;
    const centre = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    if (choiceView === 'lighting' && !side) {
      // Stand inside the front corner: selected screens remain intact behind the
      // viewer while the ceiling and occupied space can be compared at eye level.
      const width = bounds.max.x - bounds.min.x, depth = bounds.max.y - bounds.min.y;
      const eye = bounds.min.z + Math.min(1500, (bounds.max.z - bounds.min.z) * .52);
      if (initialise || !touched.current) {
        camera.position.set(bounds.min.x + width * .8, bounds.min.y + depth * .86, eye);
        orbit.target.set(bounds.min.x + width * .35, bounds.min.y + depth * .15, eye);
      }
      camera.fov = 75;
      camera.up.set(0, 0, 1);
      camera.aspect = size.width / size.height;
      camera.clearViewOffset();
      camera.lookAt(orbit.target);
      camera.updateProjectionMatrix();
      orbit.update();
      previous.current = { reset, fit, width: size.width, height: size.height, presentation, side, choiceView };
      recordCamera(); invalidate();
      return;
    }
    camera.fov = 24;
    if (initialise) {
      touched.current = false;
      const reviewAngle = explore && !portrait ? Math.min(2.0, Math.max(.85, (bounds.max.x-bounds.min.x)/(bounds.max.y-bounds.min.y)*.9)) : 1.45;
      const direction = presentation && side === 'left' ? new Vector3(-1.9, .85, .65).normalize() : presentation && side === 'right' ? new Vector3(1.9, .85, .65).normalize() : presentation && (side === 'back' || side === 'rear') ? new Vector3(.85, -1.9, .65).normalize() : choiceView === 'lighting' ? new Vector3(.85,1.9,0).normalize() : choiceView === 'sides' ? new Vector3(1.2,1.9,.6).normalize() : studio ? new Vector3(portrait ? .85 : reviewAngle,1.9,portrait ? .65 : explore ? .6 : .7).normalize() : presentation ? PRESENTATION_DIRECTION : FRONT_DIRECTION;
      camera.position.copy(centre).addScaledVector(direction, bounds.size * 3);
    } else camera.position.add(centre.clone().sub(orbit.target));
    orbit.target.copy(centre);
    camera.up.set(0, 0, 1);
    camera.aspect = size.width / size.height;
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    // Refit when expanding or collapsing the mobile viewport, even after the
    // customer has rotated it. Keep their viewing angle, but avoid a tiny model.
    if (!touched.current || previous.current?.fit !== fit || previous.current.width !== size.width || previous.current.height !== size.height) {
      const direction = camera.position.clone().sub(centre).normalize();
      const oldDistance = camera.position.distanceTo(centre);
      const tanY = Math.tan(camera.fov * Math.PI / 360);
      const paddingX = choiceView === 'sides' ? .88 : studio ? .97 : (size.width < 600 ? .92 : .86) * (surroundings ? .9 : 1);
      const paddingY = studio && portrait ? .94 : Math.max(.5, (size.height - (size.height < 320 ? 16 : 40)) / size.height) * (surroundings ? .9 : 1);
      let distance = 1000;
      for (const p of fitPoints) {
        const point = new Vector3(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse);
        const depth = point.z + oldDistance;
        distance = Math.max(distance, depth + Math.abs(point.x) / (tanY * camera.aspect * paddingX),
          depth + Math.abs(point.y) / (tanY * paddingY));
      }
      // Fit the complete product even on narrow phones. The old unconditional
      // 20% enlargement cut off end posts; customers can still zoom in freely.
      camera.position.copy(centre).addScaledVector(direction, distance);
    }
    // Tall phone canvases are width-constrained: lift the composition toward
    // the heading without cropping the product or changing the orbit target.
    if (studio && size.height > size.width * 1.25) camera.setViewOffset(size.width,size.height,0,size.height*.08,size.width,size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    orbit.update();
    previous.current = { reset, fit, width: size.width, height: size.height, presentation, side, choiceView };
    recordCamera();
    invalidate();
  }, [bounds, fitPoints, camera, size.width, size.height, reset, fit, surroundings, presentation, studio, portrait, explore, side, choiceView, invalidate, recordCamera]);

  return <OrbitControls ref={controls} makeDefault enabled={enabled} enablePan={false}
    enableDamping={false} minDistance={1000} maxDistance={100000} minPolarAngle={.15} maxPolarAngle={Math.PI * (choiceView === 'lighting' ? .5 : .48)}
    onStart={() => { touched.current = true; }} onChange={recordCamera} />;
}
