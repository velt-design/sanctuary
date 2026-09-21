import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import PreviewCamera from './PreviewCamera';

const fixture = vi.hoisted(() => ({ state: {} as any, frame: undefined as any, start: undefined as any, orbit: undefined as any }));
vi.mock('@react-three/fiber', () => ({ useThree: () => fixture.state, useFrame: (fn: unknown) => { fixture.frame = fn; } }));
vi.mock('@react-three/drei', () => ({ OrbitControls: React.forwardRef(function Controls({ onStart }: any, ref) {
  React.useImperativeHandle(ref, () => fixture.orbit); fixture.start = onStart; return null;
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
