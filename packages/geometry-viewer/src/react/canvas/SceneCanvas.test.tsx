import React, { act, Component, createContext, StrictMode, Suspense, useContext, useEffect } from 'react';
import { createRoot as createDomRoot, type Root } from 'react-dom/client';
import { createPortal, useThree, type CanvasProps, type RootState } from '@react-three/fiber';
import { Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { PCFShadowMap, PCFSoftShadowMap, Scene, WebGLCoordinateSystem, type WebGLRenderer } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SceneCanvas } from './SceneCanvas';
import { sceneCatalogue } from './sceneCatalogue';

// Vitest externalizes Fiber/Drei to CJS. Resolve Three to that same real public
// package instance, rather than mixing its ESM and CJS class identities.
vi.mock('three', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('three');
});

// No Canvas, extend(THREE), Fiber mock or test-renderer catalogue is used in this
// isolated module. Only the GPU boundary is substituted; roots/reconciler/events,
// context bridge, catalogue and real helper components execute.
const Context = createContext('initial');
let size = { width: 640, height: 480 };
const observers = new Set<ResizeObserverCallback>();
let dom: Root;
let container: HTMLDivElement;
const states: RootState[] = [];
const renderers: ReturnType<typeof renderer>[] = [];
function renderer(canvas: HTMLCanvasElement) {
  const gl = {
    domElement: canvas, render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(),
    getPixelRatio: () => 1, getSize: (target: { set: (x: number, y: number) => unknown }) => target.set(640, 480),
    shadowMap: { enabled: false, type: 0 }, renderLists: { dispose: vi.fn() },
    forceContextLoss: vi.fn(), coordinateSystem: WebGLCoordinateSystem,
    getRenderTarget: () => null, setRenderTarget: vi.fn(), getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0, xr: {
      enabled: false, isPresenting: false, addEventListener: vi.fn(),
      removeEventListener: vi.fn(), setAnimationLoop: vi.fn(),
    },
  };
  renderers.push(gl);
  return gl;
}
const makeRenderer = ({ canvas }: { canvas: HTMLCanvasElement | OffscreenCanvas }) =>
  renderer(canvas as HTMLCanvasElement) as unknown as WebGLRenderer;
function Probe({ name = 'probe' }: { name?: string }) {
  const value = useContext(Context);
  const state = useThree();
  useEffect(() => { states.push(state); });
  return <group name={`${name}:${value}`} />;
}
class Boundary extends Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <output>{this.state.error}</output> : this.props.children; }
}
async function paint(node: React.ReactNode) {
  await act(async () => { dom.render(node); });
  // A real ResizeObserver delivers an initial observation after observe().
  await act(async () => { for (const callback of observers) callback([], {} as ResizeObserver); });
  await act(async () => { await new Promise((done) => setTimeout(done, 70)); });
}
async function resize(width: number, height: number) {
  size = { width, height };
  await act(async () => { for (const callback of observers) callback([], {} as ResizeObserver); });
  await act(async () => { await new Promise((done) => setTimeout(done, 70)); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    callback: ResizeObserverCallback;
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
    unobserve() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    ...size, top: 0, left: 0, right: size.width, bottom: size.height, x: 0, y: 0, toJSON() {},
  }));
  size = { width: 640, height: 480 };
  states.length = 0; renderers.length = 0;
  container = document.createElement('div'); document.body.append(container);
  dom = createDomRoot(container);
});
afterEach(async () => {
  await act(async () => { dom.unmount(); });
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  container.remove(); observers.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('starts with an explicit fresh catalogue and rejects an unregistered intrinsic', async () => {
  expect(Object.keys(sceneCatalogue)).toHaveLength(19);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await paint(<Boundary><SceneCanvas gl={makeRenderer} frameloop="never"><torusGeometry /></SceneCanvas></Boundary>);
  expect(container.textContent).toContain('TorusGeometry is not part of the THREE namespace');
  error.mockRestore();
});

it('mounts real supported helper branches and portal CubeCamera without the full catalogue', async () => {
  const portal = new Scene();
  await paint(<SceneCanvas gl={makeRenderer} frameloop="never">
    <Probe />
    <mesh><boxGeometry /><meshStandardMaterial /></mesh>
    <instancedMesh args={[undefined, undefined, 2]}><cylinderGeometry /><meshBasicMaterial /></instancedMesh>
    <mesh><sphereGeometry /><shaderMaterial /></mesh>
    <line><lineBasicMaterial /></line><color attach="background" args={['white']} />
    <ambientLight /><directionalLight /><spotLight />
    <Environment frames={1}><Lightformer form="ring" /><Lightformer form="rect" light={{ intensity: 1 }} /><Lightformer form="box" /></Environment>
    <Line points={[[0, 0, 0], [1, 1, 1]]} />
    <Html occlude="blending"><span>scene label</span></Html>
    <OrbitControls />
    {createPortal(<group name="portal"><cubeCamera args={[.1, 1000]} /></group>, portal)}
  </SceneCanvas>);
  expect(states.length).toBeGreaterThan(0);
  expect(portal.getObjectByName('portal')?.children[0].type).toBe('CubeCamera');
  expect(document.body.textContent).toContain('scene label');
  expect(renderers[0].render).toHaveBeenCalled(); // Environment's actual cube capture.
});

it('bridges outer context updates and keeps camera/root across hidden size and StrictMode replay', async () => {
  const mounted = vi.fn(), cleaned = vi.fn(), rendered = vi.fn();
  function Lifecycle() { rendered(); useEffect(() => { mounted(); return cleaned; }, []); return <Probe />; }
  const view = (value: string) => <StrictMode><Context value={value}>
    <SceneCanvas gl={makeRenderer} frameloop="never" camera={{ position: [3, 4, 5], up: [0, 0, 1] }}><Lifecycle /></SceneCanvas>
  </Context></StrictMode>;
  await paint(view('first'));
  expect(renderers).toHaveLength(1);
  const state = states.at(-1)!; const camera = state.camera;
  expect(state.scene.getObjectByName('probe:first')).toBeTruthy();
  expect(rendered.mock.calls.length).toBeGreaterThan(1);
  camera.position.set(40, 50, 60);
  await paint(view('second'));
  await resize(0, 0);
  await resize(700, 500);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(states.at(-1)!.camera).toBe(camera);
  expect(camera.position.toArray()).toEqual([40, 50, 60]);
  expect(state.scene.getObjectByName('probe:second')).toBeTruthy();
  expect(renderers[0].forceContextLoss).not.toHaveBeenCalled();
  await paint(null);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
  await paint(view('remounted'));
  expect(renderers).toHaveLength(2);
  expect(states.at(-1)!.camera).not.toBe(camera);
  expect(cleaned).toHaveBeenCalled();
});

it('uses the latest children when async configure finishes and disposes cancelled setup', async () => {
  let resolve!: (gl: WebGLRenderer) => void;
  let pendingCanvas!: HTMLCanvasElement;
  const delayed = vi.fn(({ canvas }: { canvas: HTMLCanvasElement | OffscreenCanvas }) => {
    pendingCanvas = canvas as HTMLCanvasElement;
    return new Promise<WebGLRenderer>((done) => { resolve = done; });
  });
  const view = (name: string) => <SceneCanvas gl={delayed} frameloop="never"><Probe name={name} /></SceneCanvas>;
  await paint(view('old'));
  await paint(view('latest'));
  await act(async () => { resolve(renderer(pendingCanvas) as unknown as WebGLRenderer); });
  expect(delayed).toHaveBeenCalledTimes(1);
  expect(states.at(-1)!.scene.getObjectByName('latest:initial')).toBeTruthy();
  expect(states.at(-1)!.scene.getObjectByName('old:initial')).toBeUndefined();
  await paint(null);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  states.length = 0;
  await paint(view('cancelled'));
  await paint(null);
  await act(async () => { resolve(renderer(pendingCanvas) as unknown as WebGLRenderer); });
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(states).toHaveLength(0);
  expect(renderers.at(-1)!.forceContextLoss).toHaveBeenCalledTimes(1);
});

it('relays configure rejection to the existing outer recovery boundary', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await paint(<Boundary><SceneCanvas gl={async () => { throw new Error('renderer setup failed'); }}><Probe /></SceneCanvas></Boundary>);
  expect(container.textContent).toBe('renderer setup failed');
  expect(states).toHaveLength(0);
});

it('relays scene suspension outward and resumes the same root after asset resolution', async () => {
  let ready = false, resolve!: () => void;
  const waiting = new Promise<void>((done) => { resolve = done; });
  function Asset() { if (!ready) throw waiting; return <Probe name="loaded" />; }
  await paint(<Suspense fallback={<output>loading asset</output>}><SceneCanvas gl={makeRenderer} frameloop="never"><Asset /></SceneCanvas></Suspense>);
  expect(container.textContent).toContain('loading asset');
  await act(async () => { ready = true; resolve(); });
  await paint(<Suspense fallback={<output>loading asset</output>}><SceneCanvas gl={makeRenderer} frameloop="never"><Asset /></SceneCanvas></Suspense>);
  expect(states.at(-1)!.scene.getObjectByName('loaded:initial')).toBeTruthy();
  expect(renderers).toHaveLength(1);
  expect(renderers[0].forceContextLoss).not.toHaveBeenCalled();
});

it('preserves DOM/ref/event coordinates, live missed callbacks and capture canvas identity', async () => {
  const target = document.createElement('div'); document.body.append(target);
  const ref = React.createRef<HTMLCanvasElement>();
  const first = vi.fn(), second = vi.fn(), onCreated = vi.fn();
  const view = (missed: (event: MouseEvent) => void) => <SceneCanvas
    ref={ref} gl={makeRenderer} frameloop="never" eventSource={target} eventPrefix="client"
    onPointerMissed={missed} onCreated={onCreated} className="existing-canvas"
    aria-label="Existing scene" style={{ touchAction: 'pan-y', overflow: 'visible' }}
    fallback={<span>WebGL fallback</span>}
  ><Probe /></SceneCanvas>;
  await paint(view(first));
  const state = states.at(-1)!;
  expect(state.events.connected).toBe(target);
  expect(onCreated).toHaveBeenCalledTimes(1);
  expect(ref.current).toBe(state.gl.domElement);
  expect(container.firstElementChild?.getAttribute('aria-label')).toBe('Existing scene');
  expect((container.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
  expect((container.firstElementChild as HTMLElement).style.overflow).toBe('visible');
  expect(ref.current!.textContent).toBe('WebGL fallback');
  state.events.compute!({ clientX: 160, clientY: 120 } as never, state);
  expect(state.pointer.toArray()).toEqual([-.5, .5]);
  await paint(view(second));
  state.onPointerMissed!(new MouseEvent('click'));
  expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1);
  const capture = vi.spyOn(ref.current!, 'toDataURL').mockReturnValue('data:image/png;base64,captured');
  expect(state.gl.domElement.toDataURL('image/png')).toBe('data:image/png;base64,captured');
  expect(capture).toHaveBeenCalledWith('image/png');
  target.remove();
});

it.each([
  { name: 'Workbench perspective', props: {}, loop: 'always', orthographic: false, shadows: false },
  { name: 'Workbench top', props: { orthographic: true }, loop: 'always', orthographic: true, shadows: false },
  { name: 'Studio house', props: { shadows: true, frameloop: 'demand', dpr: [1, 1.5] }, loop: 'demand', orthographic: false, shadows: true },
  { name: 'Studio quote', props: { shadows: true, frameloop: 'demand', dpr: 1.5 }, loop: 'demand', orthographic: false, shadows: true },
  { name: 'Studio composition', props: { shadows: 'percentage', frameloop: 'demand', dpr: [1, 1.5] }, loop: 'demand', orthographic: false, shadows: 'percentage' },
  { name: 'Website', props: { shadows: false, frameloop: 'demand', dpr: [1, 1.25] }, loop: 'demand', orthographic: false, shadows: false },
])('retains $name root configuration and camera values', async ({ props, loop, orthographic, shadows }) => {
  await paint(<SceneCanvas {...props as CanvasProps} gl={makeRenderer}
    camera={{ position: [10000, 16000, 10000], up: [0, 0, 1], near: 10, far: 200000, fov: 24 }}
  ><Probe /></SceneCanvas>);
  const state = states.at(-1)!;
  expect(state.frameloop).toBe(loop);
  expect('isOrthographicCamera' in state.camera).toBe(orthographic);
  expect(state.camera.position.toArray()).toEqual([10000, 16000, 10000]);
  expect(state.camera.up.toArray()).toEqual([0, 0, 1]);
  expect([state.camera.near, state.camera.far]).toEqual([10, 200000]);
  expect(state.gl.shadowMap.enabled).toBe(!!shadows);
  expect(state.gl.shadowMap.type).toBe(shadows === 'percentage' ? PCFShadowMap : PCFSoftShadowMap);
  if (typeof props.dpr === 'number') expect(state.viewport.dpr).toBe(props.dpr);
});
