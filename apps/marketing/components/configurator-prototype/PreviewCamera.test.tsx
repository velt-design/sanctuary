import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import PreviewCamera from './PreviewCamera';

const fixture = vi.hoisted(() => ({ state: {} as any, frame: undefined as any, start: undefined as any, change: undefined as any, orbit: undefined as any }));
vi.mock('@react-three/fiber', () => ({ useThree: () => fixture.state, useFrame: (fn: unknown) => { fixture.frame = fn; } }));
vi.mock('@react-three/drei', () => ({ OrbitControls: React.forwardRef(function Controls({ onStart, onChange }: any, ref) {
  React.useImperativeHandle(ref, () => fixture.orbit); fixture.start = onStart; fixture.change = onChange; return null;
}) }));

it('holds framing for equivalent geometry, eases a new size and yields immediately to orbit input', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const camera = new PerspectiveCamera(24, 1, 10, 200000);
  fixture.orbit = { target: new Vector3(), update: () => { camera.lookAt(fixture.orbit.target); camera.updateMatrixWorld(); } };
  fixture.state = { camera, size: { width: 800, height: 650 }, gl: { domElement: document.createElement('canvas') }, invalidate: vi.fn() };
  const root = createRoot(document.createElement('div'));
  function Harness({ width, trim = 0 }: { width: number; trim?: number }) {
    const points = [{ x: 0, y: 0, z: 0 }, { x: width, y: 3000, z: 2700 + trim }];
    return <PreviewCamera framingKey={String(width)} bounds={computeSceneBoundsFromPoints(points)} fitPoints={points} enabled reset={0} fit={0} surroundings presentation studio/>;
  }
  try {
    await React.act(async () => root.render(<Harness width={6000}/>));
    const initial = camera.position.clone();
    await React.act(async () => root.render(<Harness width={6000} trim={150}/>));
    expect(camera.position.toArray()).toEqual(initial.toArray());
    await React.act(async () => root.render(<Harness width={8000}/>));
    expect(camera.position.toArray()).toEqual(initial.toArray());
    fixture.frame({}, 1 / 60);
    expect(camera.position.distanceTo(initial)).toBeGreaterThan(0);
    fixture.start();
    const interrupted = camera.position.clone();
    fixture.frame({}, 1 / 60);
    expect(camera.position.toArray()).toEqual(interrupted.toArray());
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await React.act(async () => root.render(<Harness width={9000}/>));
    const reduced = camera.position.clone();
    fixture.frame({}, 1 / 60);
    expect(camera.position.toArray()).toEqual(reduced.toArray());
    expect(reduced.distanceTo(interrupted)).toBeGreaterThan(0);
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});


it('allows an eye-level upward aim while guarding the terrace floor', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const camera = new PerspectiveCamera(24, 1, 10, 200000);
  fixture.orbit = { target: new Vector3(), update: () => { camera.lookAt(fixture.orbit.target); camera.updateMatrixWorld(); } };
  fixture.state = { camera, size: { width: 900, height: 600 }, gl: { domElement: document.createElement('canvas') }, invalidate: vi.fn() };
  const root = createRoot(document.createElement('div'));
  const points = [{ x: 0, y: 0, z: 0 }, { x: 6000, y: 3000, z: 3200 }];
  try {
    await React.act(async () => root.render(<PreviewCamera enhanced eyeLevel groundZ={200} bounds={computeSceneBoundsFromPoints(points)} fitPoints={points} enabled reset={0} fit={0} surroundings presentation studio/>));
    expect(camera.position.z).toBe(1750);
    expect(fixture.orbit.target.z).toBeGreaterThan(camera.position.z);
    expect(camera.fov).toBe(65);
    camera.position.z = -400;
    fixture.change();
    expect(camera.position.z).toBe(320);
    expect(fixture.orbit.target.z).toBeGreaterThan(camera.position.z);
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it('fits elevated supports while ordinary orbit aims above the occupied terrace', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const camera = new PerspectiveCamera(24, 1, 10, 200000);
  fixture.orbit = { target: new Vector3(), update: () => { camera.lookAt(fixture.orbit.target); camera.updateMatrixWorld(); } };
  fixture.state = { camera, size: { width: 390, height: 560 }, gl: { domElement: document.createElement('canvas') }, invalidate: vi.fn() };
  const root = createRoot(document.createElement('div'));
  const occupied = [{ x: 0, y: 0, z: 0 }, { x: 6000, y: 3000, z: 2762 }];
  const points = [...occupied, { x: 6000, y: 3000, z: -2700 }];
  const bounds = computeSceneBoundsFromPoints(points);
  const orbitTarget = computeSceneBoundsFromPoints(occupied).center;
  try {
    await React.act(async () => root.render(<PreviewCamera enhanced groundZ={0} orbitTarget={orbitTarget} bounds={bounds} fitPoints={points} enabled reset={0} fit={0} surroundings presentation studio/>));
    expect(bounds.center.z).toBe(31);
    expect(fixture.orbit.target.z).toBe(1381);
    // Complete overview still includes below-deck supports.
    for (const point of points) {
      const projected = new Vector3(point.x, point.y, point.z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
    }
    fixture.start();
    camera.position.z = -400;
    fixture.change();
    expect(camera.position.z).toBe(120);
    expect(fixture.orbit.target.z).toBeGreaterThan(camera.position.z);
    expect(camera.getWorldDirection(new Vector3()).z).toBeGreaterThan(0);
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
