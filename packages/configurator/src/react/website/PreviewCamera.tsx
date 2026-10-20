'use client';

import { useCallback, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { SceneBounds } from '@sp/geometry-viewer';
import type { Point3 } from '@sp/geometry';
import { useCameraTransition } from './useCameraTransition';

const FRONT_DIRECTION = new Vector3(1, 1.7, 1.25).normalize();
const PRESENTATION_DIRECTION = new Vector3(.85, 1.9, .65).normalize();

export default function PreviewCamera({ storageKey, preserveUserCamera = false, zoomStep = 0, enhanced = false, eyeLevel = false, groundZ = 0, orbitTarget, overviewDirection, fitPadding = 1, framingKey, choiceView, explore = false, portrait = false, studio = false, bounds, fitPoints, enabled, reset, fit, surroundings, presentation = false, side }: {
  storageKey?: string;
  preserveUserCamera?: boolean; zoomStep?: number;
  enhanced?: boolean; eyeLevel?: boolean; groundZ?: number; orbitTarget?: Point3;
  overviewDirection?: Point3;
  fitPadding?: number;
  framingKey?: string;
  choiceView?: 'sides' | 'lighting';
  explore?: boolean; portrait?: boolean; studio?: boolean; bounds: SceneBounds; fitPoints: Point3[]; enabled: boolean; reset: number; fit: number; surroundings: boolean; presentation?: boolean; side?: string;
}) {
  const { camera, size, gl, invalidate } = useThree();
  const padding = Number.isFinite(fitPadding) ? Math.min(1, Math.max(.5, fitPadding)) : 1;
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previous = useRef<{ reset: number; fit: number; padding: number; width: number; height: number; presentation: boolean; side?: string; choiceView?: string; eyeLevel?: boolean } | null>(null);
  const touched = useRef(false);
  const framedBounds = useRef<SceneBounds | null>(null);
  const framedKey = useRef<string | undefined>(undefined);
  const recordCamera = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    if (enhanced && camera.position.z < groundZ + 120) { camera.position.z = groundZ + 120; camera.lookAt(controls.current.target); }
    const stored=JSON.stringify({ projection: 'perspective', fov: camera.fov,
      position: camera.position.toArray(), target: controls.current.target.toArray(), zoom: camera.zoom,
      distance: camera.position.distanceTo(controls.current.target) });
    gl.domElement.dataset.camera=stored;
    if(storageKey)try{sessionStorage.setItem(storageKey,stored);}catch{}
  }, [camera, gl, enhanced, groundZ, storageKey]);
  const { move, cancel } = useCameraTransition(recordCamera);

  const lastZoom = useRef(zoomStep);

  useLayoutEffect(() => {
    const orbit = controls.current;
    const steps = zoomStep - lastZoom.current;
    lastZoom.current = zoomStep;
    if (!steps || !orbit || !(camera instanceof PerspectiveCamera)) return;
    cancel();
    const delta = camera.position.clone().sub(orbit.target);
    delta.setLength(Math.max(1000, Math.min(100000, delta.length() * Math.pow(.8, steps))));
    camera.position.copy(orbit.target).add(delta);
    orbit.update(); recordCamera(); invalidate();
  }, [zoomStep, camera, cancel, recordCamera, invalidate]);

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!(camera instanceof PerspectiveCamera) || !orbit || !size.width || !size.height) return;
    if(storageKey&&!previous.current){try{const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null');
      if(saved?.projection==='perspective'&&Array.isArray(saved.position)&&saved.position.length===3&&saved.position.every(Number.isFinite)&&Array.isArray(saved.target)&&saved.target.length===3&&saved.target.every(Number.isFinite)&&Number.isFinite(saved.fov)&&saved.fov>1&&saved.fov<150){
        camera.position.fromArray(saved.position);orbit.target.fromArray(saved.target);camera.fov=saved.fov;camera.aspect=size.width/size.height;camera.updateProjectionMatrix();orbit.update();previous.current={reset,fit,padding,width:size.width,height:size.height,presentation,side,choiceView,eyeLevel};recordCamera();invalidate();return;
      }
    }catch{}}
    if (preserveUserCamera && previous.current && previous.current.fit === fit && previous.current.reset === reset) {
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix(); recordCamera(); invalidate(); return;
    }
    const initialise = !previous.current || previous.current.reset !== reset || previous.current.presentation !== presentation || previous.current.side !== side || previous.current.choiceView !== choiceView || previous.current.eyeLevel !== eyeLevel;
    const resized = previous.current?.width !== size.width || previous.current?.height !== size.height;
    const oldBounds = framedBounds.current;
    // Roof finishes and new object identities are not a request to reframe.
    // Small trim differences must not move the entire composition.
    const changed = framingKey !== undefined ? framedKey.current !== framingKey : !oldBounds || (['x', 'y', 'z'] as const).some(axis => Math.abs(oldBounds.min[axis] - bounds.min[axis]) > 50 || Math.abs(oldBounds.max[axis] - bounds.max[axis]) > 50);
    if (!initialise && !resized && !changed && previous.current?.fit === fit && previous.current.padding === padding) return;
    if (process.env.NODE_ENV === 'development') gl.domElement.dataset.cameraFraming = JSON.stringify({ framingKey, previousKey: framedKey.current, initialise, resized, changed, width: size.width, height: size.height });
    const before = { position: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov };
    const firstFrame = !previous.current;
    framedBounds.current = bounds;
    framedKey.current = framingKey;
    // Below-deck supports remain fit points, not the focus of occupied-space orbit.
    const focus = orbitTarget ?? bounds.center;
    const centre = new Vector3(focus.x, focus.y, focus.z);
    if (enhanced && eyeLevel) {
      camera.fov = 65;
      camera.up.set(0, 0, 1);
      camera.aspect = size.width / size.height;
      camera.clearViewOffset();
      if (initialise || changed) {
        const width = bounds.max.x - bounds.min.x, depth = bounds.max.y - bounds.min.y;
        camera.position.set(bounds.min.x + width * .72, bounds.min.y + depth * .82, groundZ + 1550);
        orbit.target.set(bounds.min.x + width * .38, bounds.min.y + depth * .28, Math.max(groundZ + 1950, bounds.center.z + (bounds.max.z - bounds.min.z) * .26));
      }
      camera.lookAt(orbit.target); camera.updateProjectionMatrix(); orbit.update();
      move(orbit, before, firstFrame);
      previous.current = { reset, fit, padding, width: size.width, height: size.height, presentation, side, choiceView, eyeLevel };
      recordCamera(); invalidate(); return;
    }
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
      move(orbit, before, firstFrame);
      previous.current = { reset, fit, padding, width: size.width, height: size.height, presentation, side, choiceView, eyeLevel };
      recordCamera(); invalidate();
      return;
    }
    camera.fov = 24;
    const overview = overviewDirection && [overviewDirection.x,overviewDirection.y,overviewDirection.z].every(Number.isFinite) ? new Vector3(overviewDirection.x,overviewDirection.y,overviewDirection.z) : null;
    const useOverview = overview && overview.lengthSq()>0 ? overview.normalize() : null;
    if (initialise || (useOverview && (changed || previous.current?.fit !== fit))) {
      touched.current = false;
      const reviewAngle = explore && !portrait ? Math.min(2.0, Math.max(.85, (bounds.max.x-bounds.min.x)/(bounds.max.y-bounds.min.y)*.9)) : 1.45;
      const direction = presentation && side === 'left' ? new Vector3(-1.9, .85, .65).normalize() : presentation && side === 'right' ? new Vector3(1.9, .85, .65).normalize() : presentation && (side === 'back' || side === 'rear') ? new Vector3(.85, -1.9, .65).normalize() : choiceView === 'lighting' ? new Vector3(.85,1.9,0).normalize() : choiceView === 'sides' ? new Vector3(1.2,1.9,.6).normalize() : studio ? new Vector3(portrait ? .85 : reviewAngle,1.9,portrait ? .65 : explore ? .6 : .7).normalize() : presentation ? PRESENTATION_DIRECTION : FRONT_DIRECTION;
      camera.position.copy(centre).addScaledVector(useOverview ?? direction, bounds.size * 3);
    } else camera.position.add(centre.clone().sub(orbit.target));
    orbit.target.copy(centre);
    camera.up.set(0, 0, 1);
    camera.aspect = size.width / size.height;
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    // Refit when expanding or collapsing the mobile viewport, even after the
    // customer has rotated it. Keep their viewing angle, but avoid a tiny model.
    if (!touched.current || previous.current?.fit !== fit || previous.current?.padding !== padding || previous.current.width !== size.width || previous.current.height !== size.height) {
      const direction = camera.position.clone().sub(centre).normalize();
      const oldDistance = camera.position.distanceTo(centre);
      const tanY = Math.tan(camera.fov * Math.PI / 360);
      const paddingX = choiceView === 'sides' ? .88 : studio ? .97 : (size.width < 600 ? .92 : .86) * (surroundings ? .9 : 1);
      const paddingY = studio && portrait ? .94 : Math.max(.5, (size.height - (size.height < 320 ? 16 : 40)) / size.height) * (surroundings ? .9 : 1);
      let distance = 1000;
      for (const p of fitPoints) {
        const point = new Vector3(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse);
        const depth = point.z + oldDistance;
        distance = Math.max(distance, depth + Math.abs(point.x) / (tanY * camera.aspect * paddingX * padding),
          depth + Math.abs(point.y) / (tanY * paddingY * padding));
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
    move(orbit, before, firstFrame);
    previous.current = { reset, fit, padding, width: size.width, height: size.height, presentation, side, choiceView, eyeLevel };
    recordCamera();
    invalidate();
  }, [storageKey, preserveUserCamera, padding, bounds, fitPoints, camera, size.width, size.height, reset, fit, surroundings, presentation, studio, portrait, explore, side, choiceView, invalidate, recordCamera, move, framingKey, gl, overviewDirection, enhanced, eyeLevel, groundZ, orbitTarget]);

  return <OrbitControls ref={controls} makeDefault enabled={enabled} enablePan={false}
    enableDamping={false} minDistance={enhanced ? 250 : 1000} maxDistance={100000} minPolarAngle={.15} maxPolarAngle={Math.PI * (enhanced ? .88 : choiceView === 'lighting' ? .5 : .48)}
    onStart={() => { touched.current = true; cancel(); }} onChange={recordCamera} />;
}
